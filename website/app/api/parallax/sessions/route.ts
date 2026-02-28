import type { NextRequest } from 'next/server';

import { signSessionJwt } from '@/lib/parallax/auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { createClearcutSession } from '@/lib/parallax/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      password?: string;
    };
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
