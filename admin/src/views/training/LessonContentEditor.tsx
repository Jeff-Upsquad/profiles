'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RichTextEditor from '@/components/editor/RichTextEditor';
import api from '@/services/api';
import { useChapter, useLessons } from '@/hooks/useTraining';
import {
  useCreateLessonBlock,
  useDeleteLessonBlock,
  useLessonBlocks,
  useReorderLessonBlocks,
  useUpdateLessonBlock,
  type LessonBlock,
  type LessonBlockType,
} from '@/hooks/useLessonBlocks';

const UPLOAD_FOLDER = 'training-lessons';

// Files go straight to R2 with a presigned PUT rather than through the proxied
// POST /upload/file, which is capped at 50 MB and only parses image/pdf/video
// bodies. Training videos routinely exceed that, and audio wouldn't upload at
// all through the proxy.
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** R2 rejects anything outside the backend's allow-list, so mirror it here. */
const ALLOWED_MIME: Record<LessonBlockType, RegExp> = {
  text: /^$/,
  image: /^image\/(jpeg|png|webp)$/,
  video_upload: /^video\/(mp4|quicktime)$/,
  audio: /^audio\//,
  pdf: /^application\/pdf$/,
  video_embed: /^$/,
};

const BLOCK_LABEL: Record<LessonBlockType, string> = {
  text: 'Text',
  image: 'Image',
  video_upload: 'Video file',
  video_embed: 'Video link',
  audio: 'Audio',
  pdf: 'PDF',
};

/** File pickers per block type — mirrors the CHECK constraint on the table. */
const ACCEPT: Partial<Record<LessonBlockType, string>> = {
  image: 'image/jpeg,image/png,image/webp',
  video_upload: 'video/mp4,video/quicktime',
  audio: 'audio/*',
  pdf: 'application/pdf',
};

function isSupportedVideoLink(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'www.loom.com' ||
      hostname === 'loom.com' ||
      hostname === 'clips.squadhub.in'
    );
  } catch {
    return false;
  }
}

export default function LessonContentEditor({
  chapterId,
  lessonId,
}: {
  chapterId: string;
  lessonId: string;
}) {
  const { data: chapter } = useChapter(chapterId);
  const { data: lessons, isLoading: lessonsLoading } = useLessons(chapterId);
  const { data: blocks = [], isLoading } = useLessonBlocks(lessonId);

  const createBlock = useCreateLessonBlock(lessonId);
  const reorderBlocks = useReorderLessonBlocks(lessonId);
  const [pendingType, setPendingType] = useState<LessonBlockType | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  const lesson = lessons?.find((l) => l.id === lessonId);
  const ordered = useMemo(
    () => [...blocks].sort((a, b) => a.position - b.position),
    [blocks],
  );

  const addText = () =>
    createBlock.mutate({ type: 'text', position: ordered.length, text_content: null });

  const addVideoLink = () => {
    const url = window.prompt('Loom or SquadClips share URL')?.trim();
    if (!url) return;
    if (!isSupportedVideoLink(url)) {
      toast.error('Use a Loom or SquadClips (clips.squadhub.in) share link');
      return;
    }
    createBlock.mutate({
      type: 'video_embed',
      position: ordered.length,
      embed_url: url,
      embed_provider: url.includes('loom') ? 'loom' : 'squadclips',
    });
  };

  const pickFile = (type: LessonBlockType) => {
    setPendingType(type);
    // Reset so re-picking the same file still fires onChange.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = ACCEPT[type] ?? '';
      fileInputRef.current.click();
    }
  };

  const onFileChosen = async (file: File | undefined) => {
    const type = pendingType;
    if (!file || !type) return;
    if (!ALLOWED_MIME[type].test(file.type)) {
      toast.error(`Unsupported ${BLOCK_LABEL[type].toLowerCase()} format: ${file.type || 'unknown'}`);
      setPendingType(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File too large. Max upload is 500 MB.');
      setPendingType(null);
      return;
    }

    setProgress(0);
    try {
      const { data: presigned } = await api.post('/upload/presigned-url', {
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
        folder: UPLOAD_FOLDER,
      });

      await axios.put(presigned.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
        timeout: 30 * 60 * 1000,
      });

      createBlock.mutate({
        type,
        position: ordered.length,
        file_url: presigned.fileUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setProgress(null);
      setPendingType(null);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    reorderBlocks.mutate(next.map((b, i) => ({ id: b.id, position: i })));
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/training/${chapterId}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; Back to {chapter?.title ?? 'chapter'}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {lessonsLoading ? 'Loading…' : (lesson?.title ?? 'Lesson')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Lesson content — talents read this below the lesson video, exactly like an SOP page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lesson && lesson.videos.length > 0 && (
            <Badge variant="blue">
              {lesson.videos.length} video{lesson.videos.length === 1 ? '' : 's'}
            </Badge>
          )}
          <Badge variant="gray">
            {ordered.length} block{ordered.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {/* Add-block toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <span className="mr-auto text-sm font-semibold text-gray-800">Add content</span>
        <Button size="sm" variant="secondary" onClick={addText} disabled={createBlock.isPending}>
          + Text
        </Button>
        <Button size="sm" variant="secondary" onClick={addVideoLink} disabled={createBlock.isPending}>
          + Video link
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pickFile('video_upload')} disabled={uploading}>
          + Video file
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pickFile('image')} disabled={uploading}>
          + Image
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pickFile('audio')} disabled={uploading}>
          + Audio
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pickFile('pdf')} disabled={uploading}>
          + PDF
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => onFileChosen(e.target.files?.[0])}
        />
      </div>

      {uploading && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
          <span className="text-sm text-indigo-900">
            Uploading {BLOCK_LABEL[pendingType ?? 'image'].toLowerCase()}…
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-indigo-100">
            <span
              className="block h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${progress ?? 0}%` }}
            />
          </span>
          <span className="text-sm tabular-nums text-indigo-900">{progress ?? 0}%</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-gray-700">No content blocks yet</p>
          <p className="mt-1 text-sm text-gray-500">
            A lesson can stay video-only, or become a full document. Add text, media or a PDF above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              lessonId={lessonId}
              index={index}
              total={ordered.length}
              onMove={(delta) => move(index, delta)}
              reordering={reorderBlocks.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockCard({
  block,
  lessonId,
  index,
  total,
  onMove,
  reordering,
}: {
  block: LessonBlock;
  lessonId: string;
  index: number;
  total: number;
  onMove: (delta: number) => void;
  reordering: boolean;
}) {
  const updateBlock = useUpdateLessonBlock(lessonId);
  const deleteBlock = useDeleteLessonBlock(lessonId);
  const [dirty, setDirty] = useState(false);

  const saveText = (json: unknown) => {
    updateBlock.mutate({ blockId: block.id, text_content: json });
    setDirty(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-medium tabular-nums text-gray-400">{index + 1}</span>
        <Badge variant="gray">{BLOCK_LABEL[block.type]}</Badge>
        {dirty && <span className="text-xs text-amber-600">Unsaved — click outside to save</span>}
        {updateBlock.isPending && <span className="text-xs text-gray-400">Saving…</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" title="Move up" disabled={index === 0 || reordering}
            onClick={() => onMove(-1)}>↑</Button>
          <Button size="sm" variant="ghost" title="Move down" disabled={index === total - 1 || reordering}
            onClick={() => onMove(1)}>↓</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50"
            disabled={deleteBlock.isPending}
            onClick={() => {
              if (confirm('Delete this block?')) deleteBlock.mutate(block.id);
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {block.type === 'text' ? (
          <RichTextEditor
            content={block.text_content}
            onChange={() => setDirty(true)}
            onBlur={saveText}
          />
        ) : block.type === 'video_embed' ? (
          <>
            <Input
              label="Share URL"
              defaultValue={block.embed_url ?? ''}
              helperText="Loom or SquadClips (clips.squadhub.in) share link"
              onBlur={(e) =>
                updateBlock.mutate({ blockId: block.id, embed_url: e.target.value.trim() })
              }
            />
            {block.embed_url && (
              <div className="aspect-video max-w-md overflow-hidden rounded-lg bg-black">
                <iframe
                  src={block.embed_url.replace('/share/', '/embed/')}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            )}
          </>
        ) : (
          <MediaPreview block={block} />
        )}

        {block.type !== 'text' && (
          <Input
            label="Caption"
            defaultValue={block.caption ?? ''}
            placeholder="Optional caption shown under the media"
            onBlur={(e) =>
              updateBlock.mutate({ blockId: block.id, caption: e.target.value.trim() || null })
            }
          />
        )}
      </div>
    </div>
  );
}

function MediaPreview({ block }: { block: LessonBlock }) {
  if (!block.file_url) {
    return <p className="text-sm text-gray-500">No file attached.</p>;
  }
  if (block.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={block.file_url}
        alt={block.caption ?? ''}
        className="max-h-64 rounded-lg border border-gray-200 object-contain"
      />
    );
  }
  if (block.type === 'video_upload') {
    return <video src={block.file_url} controls className="max-h-64 rounded-lg bg-black" />;
  }
  if (block.type === 'audio') {
    return <audio src={block.file_url} controls className="w-full max-w-md" />;
  }
  return (
    <a
      href={block.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
    >
      {block.file_name || 'Open PDF'}
    </a>
  );
}
