import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { validateImportMapping } from '@/lib/clearcut/import-mapper';
import type { ImportMappingConfig, ImportPreviewResponse } from '@/lib/clearcut/types';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    assertValidTokenParam(token);
    const session = requireSessionByEditToken(token);
    requireAuthorizedSessionAccess(request, session, 'edit');

    const body = (await request.json().catch(() => null)) as
      | { preview?: ImportPreviewResponse; config?: ImportMappingConfig }
      | null;
    if (!body?.preview || !body?.config) {
      throw new ApiError(400, 'invalid_payload', 'preview and config are required.');
    }

    const result = validateImportMapping(body.preview, body.config);
    return successResponse(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
