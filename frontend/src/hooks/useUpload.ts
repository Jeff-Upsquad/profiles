import { useState } from 'react';
import api from '@/services/api';

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File, folder?: string): Promise<string> => {
    setUploading(true);
    setProgress(0);

    try {
      const params = new URLSearchParams({ fileName: file.name });
      if (folder) params.set('folder', folder);

      const { data } = await api.post<{ fileUrl: string; key: string }>(
        `/upload/file?${params.toString()}`,
        file,
        { headers: { 'Content-Type': file.type } }
      );

      setProgress(100);
      return data.fileUrl;
    } finally {
      setUploading(false);
    }
  };

  return { uploadFile, uploading, progress };
}
