import type { NextRequest } from 'next/server';

import { verifyAdminFromRequest } from '@/lib/parallax/admin-auth';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  getEventsByAction,
  getOverviewMetrics,
  getPageViewsByDay,
  getRecentEvents,
  getTopPages,
} from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const overview = getOverviewMetrics(30);
    const dailyViews = getPageViewsByDay(30);
    const topPages = getTopPages(30, 10);
    const eventsByAction = getEventsByAction(30);
    const recentEvents = getRecentEvents(20);

    return successResponse({
      overview,
      dailyViews,
      topPages,
      eventsByAction,
      recentEvents,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
