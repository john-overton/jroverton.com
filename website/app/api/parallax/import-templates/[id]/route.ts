import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/parallax/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/parallax/http';
import { deleteImportTemplate, getImportTemplateById, updateImportTemplate } from '@/lib/parallax/registry-db';

export const runtime = 'nodejs';

function requireTemplateAuth(request: NextRequest, idRaw: string): number {
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError(400, 'invalid_template_id', 'Template id must be a positive integer.');
  }
  const template = getImportTemplateById(id);
  if (!template) {
    throw new ApiError(404, 'template_not_found', 'Import template not found.');
  }
  assertValidTokenParam(template.edit_token);
  const session = requireSessionByEditToken(template.edit_token);
  requireAuthorizedSessionAccess(request, session, 'edit');
  return id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idRaw } = await params;
    const id = requireTemplateAuth(request, idRaw);
    const body = (await request.json().catch(() => null)) as
      | {
          templateName?: string;
          sourceSystem?: string;
          notes?: string | null;
          eventMappingJson?: string;
          fieldMappingJson?: string;
          matchRulesJson?: string;
        }
      | null;
    if (!body || typeof body !== 'object') {
      throw new ApiError(400, 'invalid_payload', 'Payload must be a JSON object.');
    }
    const updated = updateImportTemplate(id, body);
    return successResponse({ template: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idRaw } = await params;
    const id = requireTemplateAuth(request, idRaw);
    deleteImportTemplate(id);
    return successResponse({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
