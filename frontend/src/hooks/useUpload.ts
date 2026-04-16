import { useState } from 'react';
import api from '@/services/api';
import type { PresignedUrlResponse } from '@/types';

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File, folder?: string): Promise<string> => {
    setUploading(true);
    setProgress(0);

    try {
      const { data } = await api.post<PresignedUrlResponse>('/upload/presigned-url', {
        fileName: file.name,
        contentType: file.type,
        folder,
      });

      await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setProgress(100);
      return data.fileUrl;
    } finally {
      setUploading(false);
    }
  };

  return { uploadFile, uploading, progress };
}
