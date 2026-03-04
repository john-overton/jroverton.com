import type { NextRequest } from 'next/server';

import { signSessionJwt } from '@/lib/parallax/auth';
import { HONEYPOT_BLOCK_MS, HONEYPOT_MAX_TRIGGERS } from '@/lib/parallax/config';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getClientIp } from '@/lib/parallax/http';
import { createClearcutSession } from '@/lib/parallax/service';

export const runtime = 'nodejs';

/* ------------------------------------------------------------------ */
/*  Honeypot IP tracking (in-memory, same pattern as auth rate-limit) */
/* ------------------------------------------------------------------ */

interface HoneypotIpState {
  triggers: number[];
  blockedUntil: number;
}

const honeypotIps = new Map<string, HoneypotIpState>();

function getHoneypotState(ip: string): HoneypotIpState {
  const existing = honeypotIps.get(ip);
  if (!existing) {
    const initial: HoneypotIpState = { triggers: [], blockedUntil: 0 };
    honeypotIps.set(ip, initial);
    return initial;
  }
  // Clean up old triggers outside the block window
  const cutoff = Date.now() - HONEYPOT_BLOCK_MS;
  existing.triggers = existing.triggers.filter((ts) => ts > cutoff);
  return existing;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const hpState = getHoneypotState(ip);
    const now = Date.now();

    // Check if IP is blocked from previous honeypot triggers
    if (hpState.blockedUntil > now) {
      throw new ApiError(403, 'ip_blocked', 'Access denied.');
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      password?: string;
      _hp?: string;
    };

    // Honeypot check — if the hidden field was filled, it's a bot
    if (body._hp) {
      hpState.triggers.push(now);
      if (hpState.triggers.length >= HONEYPOT_MAX_TRIGGERS) {
        hpState.blockedUntil = now + HONEYPOT_BLOCK_MS;
      }
      throw new ApiError(403, 'bot_detected', 'Access denied.');
    }

    // Also block if this IP has already been flagged
    if (hpState.triggers.length >= HONEYPOT_MAX_TRIGGERS) {
      hpState.blockedUntil = now + HONEYPOT_BLOCK_MS;
      throw new ApiError(403, 'ip_blocked', 'Access denied.');
    }

    const record = await createClearcutSession({
      name: body.name,
      password: body.password,
    });
    const jwt = signSessionJwt(record.edit_token, 'edit');

    return successResponse(
      {
        session: {
          edit_token: record.edit_token,
          readonly_token: record.readonly_token,
          name: record.name,
          created_at: record.created_at,
          updated_at: record.updated_at,
          trip_count: record.trip_count,
          route_count: record.route_count,
        },
        jwt,
      },
      201,
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      return handleRouteError(new ApiError(400, 'invalid_json', 'Request body must be valid JSON.'));
    }
    return handleRouteError(err);
  }
}
