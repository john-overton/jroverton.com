import type { NextRequest } from 'next/server';

import { ApiError } from './errors';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function readUploadedFile(request: NextRequest): Promise<{
  fileBuffer: Buffer;
  fileName: string;
  formData: FormData;
}> {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ApiError(400, 'missing_file', 'Multipart form must include a file field named `file`.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      400,
      'file_too_large',
      `File exceeds the 50 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    );
  }
  const arrayBuffer = await file.arrayBuffer();
  return {
    fileBuffer: Buffer.from(arrayBuffer),
    fileName: file.name,
    formData,
  };
}
