import { useState, useRef } from 'react';
import axios from 'axios';
import api from '@/services/api';
import { usePortfolioItems, useAddPortfolioItem, useDeletePortfolioItem } from '@/hooks/useProfiles';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
// Imported for grid rendering of historical link rows (source_type='link')
// that pre-date the removal of the paste-link UI. The parser/Add flow is no
// longer wired up in this component; new portfolio video items can only be
// added via direct upload.
import { legacyProviderDisplayName } from '@/lib/videoEmbed';

// Client-side cap mirrored from backend MAX_UPLOAD_BYTES (backend
// re-validates and signs Content-Length into the URL, so a forged client
// can't bypass it).
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_LABEL = '500 MB';

interface PortfolioUploaderProps {
  profileId: string;
  skills: { skill: string }[];
}

type InFlight = { fileName: string; progress: number };

const ACCEPTED_TYPES: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/quicktime': 'video',
};

export default function PortfolioUploader({ profileId, skills }: PortfolioUploaderProps) {
  const { data: items = [] } = usePortfolioItems(profileId);
  const addItem = useAddPortfolioItem();
  const deleteItem = useDeletePortfolioItem();
  const [uploadsMap, setUploadsMap] = useState<Record<string, Record<string, InFlight>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const beginUpload = (skill: string, id: string, fileName: string) =>
    setUploadsMap((prev) => ({
      ...prev,
      [skill]: { ...(prev[skill] ?? {}), [id]: { fileName, progress: 0 } },
    }));
  const updateProgress = (skill: string, id: string, progress: number) =>
    setUploadsMap((prev) => {
      const skillMap = prev[skill];
      if (!skillMap || !skillMap[id]) return prev;
      return {
        ...prev,
        [skill]: { ...skillMap, [id]: { ...skillMap[id], progress } },
      };
    });
  const finishUpload = (skill: string, id: string) =>
    setUploadsMap((prev) => {
      const skillMap = prev[skill];
      if (!skillMap) return prev;
      const { [id]: _, ...rest } = skillMap;
      if (Object.keys(rest).length === 0) {
        const { [skill]: __, ...others } = prev;
        return others;
      }
      return { ...prev, [skill]: rest };
    });

  const handleUpload = async (file: File, skillName: string, uploadId: string) => {
    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      toast.error('Unsupported file type. Use images, PDFs, or videos.');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `"${file.name}" is too large. Max upload size is ${MAX_UPLOAD_LABEL}. ` +
          `Try compressing the video or trimming its length.`
      );
      return;
    }

    beginUpload(skillName, uploadId, file.name);
    try {
      // Step 1: ask the backend for a presigned R2 PUT URL. The backend
      // validates content type, applies MAX_UPLOAD_BYTES, and signs
      // Content-Length into the URL so R2 enforces it server-side.
      const { data: presigned } = await api.post('/upload/presigned-url', {
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
        folder: 'portfolio',
      });

      // Step 2: PUT the file directly to R2 (browser → R2, skipping the
      // VPS bandwidth path). axios.put to a raw URL preserves the
      // onUploadProgress callback we use for the per-file progress bar.
      await axios.put(presigned.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          updateProgress(skillName, uploadId, pct);
        },
        // 30 min ceiling — covers a 500 MB file even on a slow uplink.
        timeout: 30 * 60 * 1000,
      });

      // Step 3: persist the portfolio_items row pointing at the public URL.
      await addItem.mutateAsync({
        profileId,
        skill_name: skillName,
        file_url: presigned.fileUrl,
        file_type: fileType,
        file_name: file.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error(`Portfolio upload error for "${file.name}":`, err);
      toast.error(message.length > 120 ? message.slice(0, 120) + '...' : message);
      throw err;
    } finally {
      finishUpload(skillName, uploadId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSkill) {
      e.target.value = '';
      return;
    }

    const skill = activeSkill;
    const fileArray = Array.from(files);
    const batchId = Date.now();

    Promise.allSettled(
      fileArray.map((file, i) => handleUpload(file, skill, `${batchId}-${i}`))
    ).then(
      (results) => {
        if (fileArray.length > 1) {
          const failed = results.filter((r) => r.status === 'rejected').length;
          const succeeded = fileArray.length - failed;
          if (succeeded > 0) {
            toast.success(`${succeeded} of ${fileArray.length} files uploaded`);
          }
        }
      }
    );

    e.target.value = '';
  };

  const triggerUpload = (skillName: string) => {
    setActiveSkill(skillName);
    fileInputRef.current?.click();
  };

  // Group items by skill
  const itemsBySkill: Record<string, any[]> = {};
  for (const item of items) {
    if (!itemsBySkill[item.skill_name]) itemsBySkill[item.skill_name] = [];
    itemsBySkill[item.skill_name].push(item);
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Portfolio</h3>
      <p className="mb-4 text-xs text-gray-500">
        Upload images, PDFs, or videos for each skill — up to{' '}
        {MAX_UPLOAD_LABEL} per file. Videos play inline on your profile.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,video/mp4,video/quicktime"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="space-y-6">
        {skills.map(({ skill }) => {
          const inFlight = Object.values(uploadsMap[skill] ?? {});
          return (
          <div key={skill} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-700">{skill}</h4>
              <Button
                variant="outline"
                size="sm"
                loading={inFlight.length > 0}
                onClick={() => triggerUpload(skill)}
              >
                Upload
              </Button>
            </div>

            {inFlight.length > 0 && (
              <div className="mb-3 space-y-2">
                {inFlight.map((u, i) => (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-xs text-gray-600">
                      <span className="truncate pr-2">{u.fileName}</span>
                      <span className="tabular-nums">{u.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-neutral-900 transition-all duration-150"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(itemsBySkill[skill] ?? []).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(itemsBySkill[skill] ?? []).map((item: any) => (
                  <div key={item.id} className="group relative rounded-lg border border-gray-100 p-2">
                    {item.file_type === 'image' && (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="h-24 w-full rounded-md object-cover"
                      />
                    )}
                    {item.file_type === 'video' && item.source_type === 'link' && item.provider !== 'dropbox' && (
                      <div className="relative h-24 w-full overflow-hidden rounded-md bg-gray-900">
                        {item.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnail_url}
                            alt={item.file_name}
                            className="h-full w-full object-cover opacity-90"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-white/80">
                            {legacyProviderDisplayName(item.provider ?? '')}
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {legacyProviderDisplayName(item.provider ?? '')}
                        </span>
                      </div>
                    )}
                    {item.file_type === 'video' && (item.source_type !== 'link' || item.provider === 'dropbox') && (
                      <video
                        src={item.file_url}
                        className="h-24 w-full rounded-md object-cover"
                      />
                    )}
                    {item.file_type === 'pdf' && (
                      <div className="flex h-24 items-center justify-center rounded-md bg-red-50">
                        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <p className="mt-1 truncate text-xs text-gray-600">{item.file_name}</p>
                    <button
                      type="button"
                      onClick={() => deleteItem.mutate({ profileId, itemId: item.id })}
                      className="absolute right-1 top-1 hidden rounded-full bg-white p-1 text-red-500 shadow hover:bg-red-50 group-hover:block"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No portfolio items yet</p>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
