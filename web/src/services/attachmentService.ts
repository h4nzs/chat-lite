import { api } from '@lib/api';
import { encryptFile } from '@utils/crypto';

export interface UploadResult {
  url: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function processAndUploadAttachment(
  file: File, 
  onProgress?: (progress: number) => void,
  folder: string = 'attachments',
  retention: number = 86400 * 7 // Default 7 days
): Promise<UploadResult> {
  // 1. Encrypt File
  onProgress?.(5);
  const { encryptedBlob, key: fileKey } = await encryptFile(file);
  onProgress?.(20);

  // 2. Fetch Presigned URL
  const presignedRes = await api<{ uploadUrl: string, publicUrl: string, key: string }>('/api/uploads/presigned', {
      method: 'POST',
      body: JSON.stringify({
          fileName: file.name, 
          fileType: 'application/octet-stream', 
          folder,
          fileSize: encryptedBlob.size,
          fileRetention: retention
      })
  });
  onProgress?.(30);

  // 3. Upload via XHR to track progress accurately
  await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedRes.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream'); 
      
      xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 60; // Represents 30% to 90% of total flow
              onProgress?.(30 + percentComplete);
          }
      };
      
      xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error('Upload failed'));
      };
      
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(encryptedBlob);
  });

  onProgress?.(95);

  return {
    url: presignedRes.publicUrl,
    key: fileKey,
    name: file.name,
    size: file.size,
    mimeType: file.type
  };
}