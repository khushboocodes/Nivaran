/**
 * Two-step upload helper for complaint attachments.
 *
 *   1. POST /complaints/:id/attachments/sign → presigned PUT URL
 *   2. PUT the file bytes to that URL (browser → MinIO/S3 directly)
 *   3. POST /complaints/:id/attachments → record the row, return Attachment
 *
 * The browser never streams bytes through our API, which keeps the server
 * cheap and lets the upload progress fall through `XMLHttpRequest`.
 */

import type { AttachmentKind } from '@nivaran/shared';
import { apiClient } from './client';

export interface UploadedAttachment {
  id: string;
  complaintId: string;
  kind: AttachmentKind;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

interface SignResponse {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  publicUrl: string;
}

export async function uploadComplaintAttachment(args: {
  complaintId: string;
  kind: AttachmentKind;
  file: Blob;
  filename?: string;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<UploadedAttachment> {
  const { complaintId, kind, file, filename, onProgress } = args;

  const sign = await apiClient.post<SignResponse>(
    `/complaints/${complaintId}/attachments/sign`,
    {
      kind,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      filename,
    },
  );

  // Use XHR for progress events (fetch doesn't expose upload progress).
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sign.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(file);
  });

  return apiClient.post<UploadedAttachment>(`/complaints/${complaintId}/attachments`, {
    kind,
    objectKey: sign.objectKey,
    sizeBytes: file.size,
  });
}
