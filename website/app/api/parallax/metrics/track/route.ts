import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getClientIp } from '@/lib/parallax/http';
import { recordPageView } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? '';
    const body = (await request.json().catch(() => null)) as {
      page?: string;
      session_token?: string;
      referrer?: string;
    } | null;

    if (!body?.page) {
      throw new ApiError(400, 'missing_page', 'page field is required.');
    }

    recordPageView({
      ip,
      page: body.page,
      sessionToken: body.session_token ?? null,
      userAgent,
      referrer: body.referrer ?? null,
    });

    return successResponse({ tracked: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
