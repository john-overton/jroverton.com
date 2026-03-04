import type { NextRequest } from 'next/server';

import { verifyAdminFromRequest } from '@/lib/parallax/admin-auth';
import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import { getInMemoryBlockedIps } from '@/lib/parallax/honeypot';
import { getHoneypotBlocks } from '@/lib/parallax/metrics-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    verifyAdminFromRequest(request);

    const dbBlocks = getHoneypotBlocks();
    const inMemoryBlocks = getInMemoryBlockedIps();

    // Merge in-memory blocks with DB blocks, deduplicating by IP
    const seenIps = new Set(dbBlocks.map((b) => b.ip));
    const activeInMemory = inMemoryBlocks
      .filter((b) => !seenIps.has(b.ip))
      .map((b) => ({
        id: 0,
        ip: b.ip,
        trigger_count: b.triggerCount,
        blocked_until: new Date(b.blockedUntil).toISOString(),
        created_at: new Date().toISOString(),
        source: 'memory' as const,
      }));

    const blocks = [
      ...dbBlocks.map((b) => ({ ...b, source: 'db' as const })),
      ...activeInMemory,
    ];

    return successResponse({ blocks });
  } catch (err) {
    return handleRouteError(err);
  }
}
