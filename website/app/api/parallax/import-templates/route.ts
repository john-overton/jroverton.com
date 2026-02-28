import type { NextRequest } from 'next/server';

import { ApiError, handleRouteError, successResponse } from '@/lib/clearcut/errors';
import {
  assertValidTokenParam,
  requireAuthorizedSessionAccess,
  requireSessionByEditToken,
} from '@/lib/clearcut/http';
import { createImportTemplate, listImportTemplates } from '@/lib/clearcut/registry-db';

export const runtime = 'nodejs';

function requireEditSessionAuth(request: NextRequest, editToken: string) {
  assertValidTokenParam(editToken);
  const session = requireSessionByEditToken(editToken);
  requireAuthorizedSessionAccess(request, session, 'edit');
}

export async function GET(request: NextRequest) {
  try {
    const editToken = request.nextUrl.searchParams.get('token') ?? '';
    if (!editToken) {
      throw new ApiError(400, 'missing_token', 'token query parameter is required.');
    }
    requireEditSessionAuth(request, editToken);
    const templates = listImportTemplates(editToken);
    return successResponse({ items: templates, count: templates.length });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          editToken?: string;
          templateName?: string;
          sourceSystem?: string;
          notes?: string;
          eventMappingJson?: string;
          fieldMappingJson?: string;
          matchRulesJson?: string;
        }
      | null;
    if (!body?.editToken || !body.templateName || !body.sourceSystem) {
      throw new ApiError(400, 'invalid_payload', 'editToken, templateName, and sourceSystem are required.');
    }
    requireEditSessionAuth(request, body.editToken);
    const created = createImportTemplate({
      editToken: body.editToken,
      templateName: body.templateName,
      sourceSystem: body.sourceSystem,
      notes: body.notes ?? null,
      eventMappingJson: body.eventMappingJson ?? '{}',
      fieldMappingJson: body.fieldMappingJson ?? '{}',
      matchRulesJson: body.matchRulesJson ?? '{}',
    });
    return successResponse({ template: created }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
