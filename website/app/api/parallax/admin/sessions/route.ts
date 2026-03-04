import type { NextRequest } from 'next/server';

import { verifyAdminFromRequest } from '@/lib/parallax/admin-auth';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getRegistryDb } from '@/lib/parallax/registry-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const sessions = getRegistryDb()
      .prepare(
        `SELECT edit_token, readonly_token, name, password_hash IS NOT NULL as has_password,
                created_at, updated_at, accessed_at, trip_count, route_count
         FROM sessions
         ORDER BY accessed_at DESC`,
      )
      .all() as Array<{
      edit_token: string;
      readonly_token: string;
      name: string;
      has_password: number;
      created_at: string;
      updated_at: string;
      accessed_at: string;
      trip_count: number;
      route_count: number;
    }>;

    return successResponse({
      sessions: sessions.map((s) => ({
        ...s,
        has_password: !!s.has_password,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
