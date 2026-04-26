import { useState, useRef, useMemo } from 'react';
import api from '@/services/api';
import { usePortfolioItems, useAddPortfolioItem, useDeletePortfolioItem } from '@/hooks/useProfiles';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import {
  parseVideoUrl,
  PROVIDER_DISPLAY_NAME,
  type ParsedVideo,
} from '@/lib/videoEmbed';

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

    beginUpload(skillName, uploadId, file.name);
    try {
      // Upload file through backend
      const { data: uploaded } = await api.post(
        `/upload/file?fileName=${encodeURIComponent(file.name)}&folder=portfolio`,
        file,
        {
          headers: { 'Content-Type': file.type },
          onUploadProgress: (e) => {
            if (!e.total) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            updateProgress(skillName, uploadId, pct);
          },
        }
      );

      // Add portfolio item
      await addItem.mutateAsync({
        profileId,
        skill_name: skillName,
        file_url: uploaded.fileUrl,
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

  // ---- Video link paste flow (per-skill state) ----
  const [linkOpenSkill, setLinkOpenSkill] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const parsedLink: ParsedVideo | null = useMemo(
    () => (linkInput.trim() ? parseVideoUrl(linkInput) : null),
    [linkInput]
  );

  const openLinkPanel = (skill: string) => {
    setLinkOpenSkill(skill);
    setLinkInput('');
  };
  const closeLinkPanel = () => {
    setLinkOpenSkill(null);
    setLinkInput('');
  };

  const submitLink = async (skill: string) => {
    if (!parsedLink) return;
    setLinkSubmitting(true);
    try {
      const fileName = `${PROVIDER_DISPLAY_NAME[parsedLink.provider]} video`;
      await addItem.mutateAsync({
        profileId,
        skill_name: skill,
        file_url: parsedLink.embedUrl,
        file_type: 'video',
        file_name: fileName,
        source_type: 'link',
        provider: parsedLink.provider,
        external_url: parsedLink.externalUrl,
        embed_url: parsedLink.embedUrl,
      });
      closeLinkPanel();
    } catch (err) {
      // toast already raised by mutation onError
      console.error('Add video link failed:', err);
    } finally {
      setLinkSubmitting(false);
    }
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
        Upload images, PDFs, or videos for each skill — or paste a public video
        link from YouTube, Vimeo, Loom, Google Drive, or Dropbox
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={inFlight.length > 0}
                  onClick={() => triggerUpload(skill)}
                >
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    linkOpenSkill === skill ? closeLinkPanel() : openLinkPanel(skill)
                  }
                >
                  {linkOpenSkill === skill ? 'Cancel' : 'Paste video link'}
                </Button>
              </div>
            </div>

            {linkOpenSkill === skill && (
              <div className="mb-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Paste a public video link
                </label>
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…  or  drive.google.com/…  or  loom.com/share/…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
                  autoFocus
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-h-[1.25rem] text-xs">
                    {linkInput.trim() === '' ? (
                      <span className="text-gray-500">
                        Supported: YouTube, Vimeo, Loom, Google Drive, Dropbox
                      </span>
                    ) : parsedLink ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        <span aria-hidden>✓</span>
                        Detected: {PROVIDER_DISPLAY_NAME[parsedLink.provider]}
                        {parsedLink.provider === 'gdrive' && (
                          <span className="ml-1 font-normal text-emerald-700/80">
                            — make sure sharing is &ldquo;Anyone with the link&rdquo;
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                        <span aria-hidden>✗</span>
                        Unrecognized link — supported: YouTube, Vimeo, Loom, Google Drive, Dropbox
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!parsedLink || linkSubmitting}
                    loading={linkSubmitting}
                    onClick={() => submitLink(skill)}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}

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
                            {PROVIDER_DISPLAY_NAME[item.provider as keyof typeof PROVIDER_DISPLAY_NAME] ?? 'Video link'}
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {PROVIDER_DISPLAY_NAME[item.provider as keyof typeof PROVIDER_DISPLAY_NAME] ?? 'Link'}
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
