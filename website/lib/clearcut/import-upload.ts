import type { NextRequest } from 'next/server';

import { ApiError } from './errors';

export async function readUploadedFile(request: NextRequest): Promise<{
  fileBuffer: Buffer;
  fileName: string;
}> {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new ApiError(400, 'missing_file', 'Multipart form must include a file field named `file`.');
  }
  const arrayBuffer = await file.arrayBuffer();
  return {
    fileBuffer: Buffer.from(arrayBuffer),
    fileName: file.name,
  };
}
