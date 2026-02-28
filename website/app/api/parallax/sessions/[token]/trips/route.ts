import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByToken,
} from '@/lib/parallax/http';
import { touchSessionAccess } from '@/lib/parallax/registry-db';
import { listTrips } from '@/lib/parallax/session-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const resolved = requireSessionByToken(token);
    requireAuthorizedSessionAccess(request, resolved.session, 'readonly');
    touchSessionAccess(resolved.session.edit_token);

    const limitRaw = request.nextUrl.searchParams.get('limit');
    const offsetRaw = request.nextUrl.searchParams.get('offset');
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const offset = offsetRaw ? Number(offsetRaw) : undefined;

    const trips = listTrips(resolved.session.edit_token, limit, offset);
    return successResponse({
      items: trips,
      limit: limit ?? null,
      offset: offset ?? null,
      count: trips.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
