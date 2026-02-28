import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { buildImportPreview } from '@/lib/clearcut/import-mapper';

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

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(400, 'missing_file', 'Multipart form must include a file field named `file`.');
    }
    const sheetNameRaw = formData.get('sheet_name');
    const sheetName = typeof sheetNameRaw === 'string' && sheetNameRaw.trim() ? sheetNameRaw : undefined;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const preview = buildImportPreview(fileBuffer, sheetName);
    return successResponse(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
