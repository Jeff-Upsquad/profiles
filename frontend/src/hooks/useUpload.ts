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
        filename: file.name,
        content_type: file.type,
        folder,
      });

      await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setProgress(100);
      return data.file_url;
    } finally {
      setUploading(false);
    }
  };

  return { uploadFile, uploading, progress };
}
