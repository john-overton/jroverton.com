import type { NextRequest } from 'next/server';

import { verifyAdminFromRequest } from '@/lib/parallax/admin-auth';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getEventLog } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const action = url.searchParams.get('action') ?? undefined;

    const result = getEventLog({ page, limit, action });
    return successResponse(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
