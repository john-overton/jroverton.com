import type { NextRequest } from 'next/server';

import { verifyAdminFromRequest } from '@/lib/parallax/admin-auth';
import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getAllAdminSettings, getMapboxStatus, setAdminSetting } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const settings = getAllAdminSettings();
    const mapboxStatus = getMapboxStatus();

    return successResponse({ settings, mapboxStatus });
  } catch (err) {
    return handleRouteError(err);
  }
}

const ALLOWED_KEYS = new Set([
  'mapbox_billing_cycle_day',
  'mapbox_monthly_limit',
  'mapbox_counter_reset_at',
  'mapbox_count_offset',
]);

export async function PUT(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const body = (await request.json().catch(() => null)) as Record<string, string> | null;
    if (!body || typeof body !== 'object') {
      throw new ApiError(400, 'invalid_json', 'Request body must be a valid JSON object.');
    }

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new ApiError(400, 'invalid_key', `Setting key "${key}" is not recognized.`);
      }
      if (typeof value !== 'string') {
        throw new ApiError(400, 'invalid_value', `Value for "${key}" must be a string.`);
      }

      if (key === 'mapbox_billing_cycle_day') {
        const day = parseInt(value, 10);
        if (!Number.isFinite(day) || day < 1 || day > 28) {
          throw new ApiError(400, 'invalid_value', 'Billing cycle day must be 1-28.');
        }
      }
      if (key === 'mapbox_monthly_limit') {
        const limit = parseInt(value, 10);
        if (!Number.isFinite(limit) || limit < 0) {
          throw new ApiError(400, 'invalid_value', 'Monthly limit must be a non-negative integer.');
        }
      }

      setAdminSetting(key, value);
    }

    const settings = getAllAdminSettings();
    const mapboxStatus = getMapboxStatus();

    return successResponse({ settings, mapboxStatus });
  } catch (err) {
    return handleRouteError(err);
  }
}
