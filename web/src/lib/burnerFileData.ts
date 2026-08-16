export interface BurnerFileMeta {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileKey: string;
}

// Burner file metadata arrives in TWO schemas depending on which UI sent it:
// - Guest (/drop BurnerChat): { fileUrl, fileName, fileType, fileSize, fileKey }
// - Host (main ChatWindow MessageInput/coreSendMessage): { url, key, name, size, mimeType }
// Normalize both so the receiving bubble always shows the preview/decrypt works.
export function extractBurnerFileData(data: Record<string, unknown>): Partial<BurnerFileMeta> {
  const fileUrl = (data.fileUrl as string | undefined) ?? (data.url as string | undefined);
  const fileKey = (data.fileKey as string | undefined) ?? (data.key as string | undefined);

  // If neither a URL nor a key is present, treat it as a plain text message.
  if (!fileUrl && !fileKey) return {};

  return {
    fileUrl,
    fileName: (data.fileName as string | undefined) ?? (data.name as string | undefined),
    fileType: (data.fileType as string | undefined) ?? (data.mimeType as string | undefined),
    fileSize: (data.fileSize as number | undefined) ?? (data.size as number | undefined),
    fileKey,
  };
}