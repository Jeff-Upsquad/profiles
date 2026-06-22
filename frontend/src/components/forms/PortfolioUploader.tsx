import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import {
  usePortfolioItems,
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useUpdatePortfolioItem,
} from '@/hooks/useProfiles';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import {
  parseVideoUrl,
  legacyProviderDisplayName,
  type ParsedVideo,
} from '@/lib/videoEmbed';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_LABEL = '500 MB';

const UNCATEGORIZED = '__uncategorized__';

interface PortfolioUploaderProps {
  profileId: string;
  /** Skills the editor selected on their profile — used as the option list
   * for per-video skill chips. */
  skills: { skill: string }[];
  /** Categories the editor selected — used as the upload buckets. Items
   * whose category_name doesn't match (legacy uploads) land in
   * "Uncategorized" so the editor can reassign them. */
  categories: string[];
  categoryId?: string;
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

interface ItemSkillChipsProps {
  profileId: string;
  item: any;
  selectedSkills: string[];
  availableSkills: string[];
}

function ItemSkillChips({ profileId, item, selectedSkills, availableSkills }: ItemSkillChipsProps) {
  const updateItem = useUpdatePortfolioItem();
  if (availableSkills.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {availableSkills.map((skill) => {
        const isSelected = selectedSkills.includes(skill);
        return (
          <button
            key={skill}
            type="button"
            disabled={updateItem.isPending}
            onClick={() => {
              const next = isSelected
                ? selectedSkills.filter((s) => s !== skill)
                : [...selectedSkills, skill];
              updateItem.mutate({ profileId, itemId: item.id, skill_names: next });
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              isSelected
                ? 'border-[#0a0a0a] bg-[#F5F5F6] text-[#0a0a0a]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {skill}
          </button>
        );
      })}
    </div>
  );
}

interface ItemCategorySelectProps {
  profileId: string;
  itemId: string;
  current: string | null | undefined;
  options: string[];
}

function ItemCategorySelect({ profileId, itemId, current, options }: ItemCategorySelectProps) {
  const updateItem = useUpdatePortfolioItem();
  return (
    <select
      value={current ?? ''}
      disabled={updateItem.isPending}
      onChange={(e) => {
        const value = e.target.value;
        updateItem.mutate({
          profileId,
          itemId,
          category_name: value === '' ? null : value,
        });
      }}
      className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 focus:border-[#737373] focus:outline-none focus:ring-1 focus:ring-[#737373]"
    >
      <option value="">Uncategorized</option>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export default function PortfolioUploader({
  profileId,
  skills,
  categories,
  categoryId,
}: PortfolioUploaderProps) {
  const { data: items = [] } = usePortfolioItems(profileId);
  const addItem = useAddPortfolioItem();
  const deleteItem = useDeletePortfolioItem();
  const [uploadsMap, setUploadsMap] = useState<Record<string, Record<string, InFlight>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeBucket, setActiveBucket] = useState<string | null>(null);

  // Pull the full template skill list for this admin category — we use it
  // as the per-video chip option list. The editor's selected skills
  // (`skills` prop) are a subset; we still let them tag any template skill
  // since a single video can demonstrate skills they didn't proactively
  // select on the profile.
  const { data: templateSkills = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['templateSkills', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/skills`);
      return data.skills ?? data;
    },
    enabled: Boolean(categoryId),
  });

  const skillChipOptions = templateSkills.length > 0
    ? templateSkills.map((s) => s.name)
    : skills.map((s) => s.skill);

  const beginUpload = (bucket: string, id: string, fileName: string) =>
    setUploadsMap((prev) => ({
      ...prev,
      [bucket]: { ...(prev[bucket] ?? {}), [id]: { fileName, progress: 0 } },
    }));
  const updateProgress = (bucket: string, id: string, progress: number) =>
    setUploadsMap((prev) => {
      const m = prev[bucket];
      if (!m || !m[id]) return prev;
      return { ...prev, [bucket]: { ...m, [id]: { ...m[id], progress } } };
    });
  const finishUpload = (bucket: string, id: string) =>
    setUploadsMap((prev) => {
      const m = prev[bucket];
      if (!m) return prev;
      const { [id]: _, ...rest } = m;
      if (Object.keys(rest).length === 0) {
        const { [bucket]: __, ...others } = prev;
        return others;
      }
      return { ...prev, [bucket]: rest };
    });

  const handleUpload = async (file: File, categoryName: string, uploadId: string) => {
    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      toast.error('Unsupported file type. Use images, PDFs, or videos.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `"${file.name}" is too large. Max upload size is ${MAX_UPLOAD_LABEL}. ` +
          `Try compressing the video or trimming its length.`,
      );
      return;
    }

    beginUpload(categoryName, uploadId, file.name);
    try {
      const { data: presigned } = await api.post('/upload/presigned-url', {
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
        folder: 'portfolio',
      });

      await axios.put(presigned.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          updateProgress(categoryName, uploadId, pct);
        },
        timeout: 30 * 60 * 1000,
      });

      // Use the category name as the legacy skill_name fallback so older
      // server reads (skill_name NOT NULL) still satisfy the constraint.
      // The new junction starts empty — the editor tags skills via chips.
      await addItem.mutateAsync({
        profileId,
        skill_name: categoryName,
        category_name: categoryName,
        skill_names: [],
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
      finishUpload(categoryName, uploadId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeBucket) {
      e.target.value = '';
      return;
    }
    const bucket = activeBucket;
    const fileArray = Array.from(files);
    const batchId = Date.now();

    Promise.allSettled(
      fileArray.map((file, i) => handleUpload(file, bucket, `${batchId}-${i}`)),
    ).then((results) => {
      if (fileArray.length > 1) {
        const failed = results.filter((r) => r.status === 'rejected').length;
        const succeeded = fileArray.length - failed;
        if (succeeded > 0) toast.success(`${succeeded} of ${fileArray.length} files uploaded`);
      }
    });

    e.target.value = '';
  };

  const triggerUpload = (bucket: string) => {
    setActiveBucket(bucket);
    fileInputRef.current?.click();
  };

  // ---- YouTube link paste flow (per-bucket state) ----
  const [linkOpenBucket, setLinkOpenBucket] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const parsedLink: ParsedVideo | null = useMemo(
    () => (linkInput.trim() ? parseVideoUrl(linkInput) : null),
    [linkInput]
  );

  const openLinkPanel = (bucket: string) => {
    setLinkOpenBucket(bucket);
    setLinkInput('');
  };
  const closeLinkPanel = () => {
    setLinkOpenBucket(null);
    setLinkInput('');
  };

  const submitLink = async (bucket: string) => {
    if (!parsedLink) return;
    setLinkSubmitting(true);
    try {
      // Like uploads: use bucket name as legacy skill_name fallback so the
      // NOT NULL column is satisfied; the new junction starts empty —
      // editor tags skills via chips after the link is added.
      await addItem.mutateAsync({
        profileId,
        skill_name: bucket,
        category_name: bucket,
        skill_names: [],
        file_url: parsedLink.embedUrl,
        file_type: 'video',
        file_name: 'YouTube video',
        source_type: 'link',
        provider: parsedLink.provider,
        external_url: parsedLink.externalUrl,
        embed_url: parsedLink.embedUrl,
      });
      closeLinkPanel();
    } catch (err) {
      // toast already raised by mutation onError
      console.error('Add YouTube link failed:', err);
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Bucket items by category. Anything without a category — or whose
  // category isn't in the editor's current selection — falls into
  // Uncategorized so legacy items are visible and editable.
  const itemsByBucket: Record<string, any[]> = {};
  for (const item of items as any[]) {
    const bucket = item.category_name && categories.includes(item.category_name)
      ? item.category_name
      : item.category_name && !categories.includes(item.category_name)
        ? item.category_name
        : UNCATEGORIZED;
    if (!itemsByBucket[bucket]) itemsByBucket[bucket] = [];
    itemsByBucket[bucket].push(item);
  }

  // Order: editor's selected categories first (in their selection order),
  // then any other category that has items, then Uncategorized at the end.
  const orderedBuckets: string[] = [];
  for (const c of categories) orderedBuckets.push(c);
  for (const c of Object.keys(itemsByBucket)) {
    if (c === UNCATEGORIZED) continue;
    if (!orderedBuckets.includes(c)) orderedBuckets.push(c);
  }
  if (itemsByBucket[UNCATEGORIZED]?.length) orderedBuckets.push(UNCATEGORIZED);

  if (orderedBuckets.length === 0) return null;

  const renderBucket = (bucket: string) => {
    const isUncategorized = bucket === UNCATEGORIZED;
    const inFlight = Object.values(uploadsMap[bucket] ?? {});
    const bucketItems = itemsByBucket[bucket] ?? [];

    return (
      <div key={bucket} className="rounded-lg border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-700">
            {isUncategorized ? 'Uncategorized' : bucket}
            {isUncategorized && bucketItems.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                — assign a category to each item below
              </span>
            )}
          </h4>
          {!isUncategorized && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={inFlight.length > 0}
                onClick={() => triggerUpload(bucket)}
              >
                Upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  linkOpenBucket === bucket ? closeLinkPanel() : openLinkPanel(bucket)
                }
              >
                {linkOpenBucket === bucket ? 'Cancel' : 'Paste YouTube link'}
              </Button>
            </div>
          )}
        </div>

        {linkOpenBucket === bucket && (
          <div className="mb-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Paste a YouTube link
            </label>
            <input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…  or  youtu.be/…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-neutral-700 focus:outline-none"
              autoFocus
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-h-[1.25rem] text-xs">
                {linkInput.trim() === '' ? (
                  <span className="text-gray-500">
                    Make sure the video is public or unlisted
                  </span>
                ) : parsedLink ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    <span aria-hidden>✓</span>
                    YouTube link detected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                    <span aria-hidden>✗</span>
                    Not a valid YouTube URL — paste a youtube.com/watch?v=… or youtu.be/… link
                  </span>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!parsedLink || linkSubmitting}
                loading={linkSubmitting}
                onClick={() => submitLink(bucket)}
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

        {bucketItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bucketItems.map((item: any) => (
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
                  <video src={item.file_url} className="h-24 w-full rounded-md object-cover" />
                )}
                {item.file_type === 'pdf' && (
                  <div className="flex h-24 items-center justify-center rounded-md bg-red-50">
                    <svg
                      className="h-8 w-8 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <p className="mt-1 truncate text-xs text-gray-600">{item.file_name}</p>

                {/* Category re-bucket selector */}
                <ItemCategorySelect
                  profileId={profileId}
                  itemId={item.id}
                  current={item.category_name}
                  options={categories}
                />

                {/* Per-video skill chips */}
                <ItemSkillChips
                  profileId={profileId}
                  item={item}
                  selectedSkills={item.skills ?? []}
                  availableSkills={skillChipOptions}
                />

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
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Portfolio</h3>
      <p className="mb-4 text-xs text-gray-500">
        Upload images, PDFs, or videos under each category — up to {MAX_UPLOAD_LABEL} per file.
        You can also paste a YouTube link if your video is hosted there. Tag the skills
        demonstrated in each video using the chips below it.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,video/mp4,video/quicktime"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="space-y-6">{orderedBuckets.map(renderBucket)}</div>
    </div>
  );
}
