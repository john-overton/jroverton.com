import type { NextRequest } from 'next/server';

import { signSessionJwt } from '@/lib/parallax/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { checkHoneypot } from '@/lib/parallax/honeypot';
import { getClientIp } from '@/lib/parallax/http';
import { recordApiEvent, recordHoneypotBlock } from '@/lib/parallax/metrics-db';
import { createClearcutSession } from '@/lib/parallax/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      password?: string;
      _hp?: string;
    };

    // Honeypot check
    const hpResult = checkHoneypot(ip, !!body._hp);
    if (hpResult !== 'allowed') {
      try {
        recordHoneypotBlock({
          ip,
          triggerCount: 1,
          blockedUntil: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        });
      } catch {
        // Metrics recording should never break the main flow
      }
      throw new ApiError(403, hpResult === 'bot_blocked' ? 'bot_detected' : 'ip_blocked', 'Access denied.');
    }

    const record = await createClearcutSession({
      name: body.name,
      password: body.password,
    });
    const jwt = signSessionJwt(record.edit_token, 'edit');

    try {
      recordApiEvent({
        ip,
        method: 'POST',
        path: '/api/parallax/sessions',
        action: 'session_create',
        sessionToken: record.edit_token,
        statusCode: 201,
      });
    } catch {
      // Metrics recording should never break the main flow
    }

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
