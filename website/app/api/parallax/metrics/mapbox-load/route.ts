import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getMapboxStatus, recordMapboxLoad } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      session_token?: string;
    } | null;

    recordMapboxLoad(body?.session_token ?? null);
    const status = getMapboxStatus();

    return successResponse(status);
  } catch (err) {
    return handleRouteError(err);
  }
}
