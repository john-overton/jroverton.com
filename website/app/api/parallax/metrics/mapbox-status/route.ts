import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getMapboxStatus } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = getMapboxStatus();
    return successResponse(status);
  } catch (err) {
    return handleRouteError(err);
  }
}
