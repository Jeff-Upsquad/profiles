import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useUpload } from '@/hooks/useUpload';

interface FileUploadFieldProps {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  folder?: string;
  disabled?: boolean;
}

export default function FileUploadField({
  label,
  value,
  onChange,
  accept,
  folder,
  disabled,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading } = useUpload();
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const url = await uploadFile(file, folder);
      onChange(url);
      toast.success('File uploaded');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline"
          >
            View current file
          </a>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => onChange(null)}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
