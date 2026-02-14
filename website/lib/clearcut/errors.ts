import { NextResponse } from 'next/server';

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiErrorPayload,
} from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function errorResponse(
  status: number,
  payload: ApiErrorPayload,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ ok: false, error: payload }, { status });
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function handleRouteError(err: unknown): NextResponse<ApiErrorResponse> {
  if (isApiError(err)) {
    return errorResponse(err.status, {
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  return errorResponse(500, {
    code: 'internal_error',
    message: 'Unexpected server error.',
  });
}
