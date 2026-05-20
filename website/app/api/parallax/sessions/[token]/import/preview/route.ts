import type { NextRequest } from 'next/server';

import { handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { readUploadedFile } from '@/lib/parallax/import-upload';
import { buildImportPreview } from '@/lib/parallax/import-mapper';

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

    const { fileBuffer, formData } = await readUploadedFile(request);
    const sheetNameRaw = formData.get('sheet_name');
    const sheetName = typeof sheetNameRaw === 'string' && sheetNameRaw.trim() ? sheetNameRaw : undefined;
    const preview = buildImportPreview(fileBuffer, sheetName);
    return successResponse(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
