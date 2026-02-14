import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { buildImportPreview } from '@/lib/clearcut/import-mapper';
import { readUploadedFile } from '@/lib/clearcut/import-upload';

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

    const { fileBuffer } = await readUploadedFile(request);
    const preview = buildImportPreview(fileBuffer);
    return successResponse(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
