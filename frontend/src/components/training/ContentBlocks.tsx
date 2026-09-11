'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Shared renderer for training content blocks.
 *
 * Both `training_sop_blocks` (Systems & Procedures pages) and
 * `training_lesson_blocks` (course lessons) store the same shape, so the SOP
 * reader and the course reader render through this one component. SOPs only
 * ever use the text/image/video_embed/pdf subset; lessons can also carry
 * uploaded video and audio.
 */
export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video_upload' | 'video_embed' | 'audio' | 'pdf';
  position: number;
  text_content?: unknown;
  file_url?: string | null;
  file_name?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown>;
}

// Both supported providers (Loom and SquadClips / clips.squadhub.in) expose a
// chrome-free player at the same token under `/embed/` instead of `/share/`.
function videoEmbedUrl(shareUrl: string): string {
  return shareUrl.replace('/share/', '/embed/');
}

/** Only ever hand http(s) URLs to href/src — never `javascript:` and friends. */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? 'https://x' : window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/* ================================================================== */
/* Rich text — renders the Tiptap JSON the admin editor authors        */
/* ================================================================== */

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, any> }[];
}

/** Wrap a text leaf in its marks, innermost first. */
function applyMarks(text: string, marks: TiptapNode['marks']): ReactNode {
  let node: ReactNode = text;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        node = <strong className="font-semibold text-[#0a0a0a]">{node}</strong>;
        break;
      case 'italic':
        node = <em>{node}</em>;
        break;
      case 'underline':
        node = <u>{node}</u>;
        break;
      case 'strike':
        node = <s>{node}</s>;
        break;
      case 'highlight':
        node = <mark className="rounded-[2px] bg-[#FFFAC2] px-0.5">{node}</mark>;
        break;
      case 'code':
        node = (
          <code className="rounded bg-[#F0F0F0] px-1 py-0.5 font-mono text-[0.9em]">{node}</code>
        );
        break;
      case 'link': {
        const href = safeUrl(mark.attrs?.href);
        node = href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            {node}
          </a>
        ) : (
          node
        );
        break;
      }
      default:
        break;
    }
  }
  return node;
}

/**
 * Per-block heading counter. Headings are numbered in document order so
 * `collectHeadings` — which walks the same tree the same way — produces the
 * exact ids the rendered elements carry, with no DOM scanning.
 */
interface RenderCtx {
  blockId: string;
  headingIndex: number;
}

export function headingAnchorId(blockId: string, index: number): string {
  return `blk-${blockId}-h${index}`;
}

function renderNodes(nodes: TiptapNode[] | undefined, ctx: RenderCtx): ReactNode {
  return (nodes ?? []).map((node, i) => <Fragment key={i}>{renderNode(node, ctx)}</Fragment>);
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-7 mb-2 text-[22px] font-semibold leading-tight tracking-[-0.015em] text-[#0a0a0a]',
  2: 'mt-6 mb-2 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-[#0a0a0a]',
  3: 'mt-5 mb-1.5 text-[15.5px] font-semibold leading-snug text-[#0a0a0a]',
};

function renderNode(node: TiptapNode, ctx: RenderCtx): ReactNode {
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks);
    case 'paragraph': {
      // Tiptap emits an empty paragraph for a blank line — keep the gap.
      if (!node.content?.length) return <p className="h-4" />;
      return (
        <p className="my-2.5 text-[14.5px] leading-[1.75] text-[#404040]">
          {renderNodes(node.content, ctx)}
        </p>
      );
    }
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2));
      const Tag = (`h${level}` as unknown) as 'h1';
      const id = headingAnchorId(ctx.blockId, ctx.headingIndex++);
      return (
        <Tag id={id} className={HEADING_CLASS[level]} style={{ scrollMarginTop: 16 }}>
          {renderNodes(node.content, ctx)}
        </Tag>
      );
    }
    case 'bulletList':
      return (
        <ul className="my-2.5 list-disc space-y-1 pl-5 text-[14.5px] leading-[1.7] text-[#404040] marker:text-[#a3a3a3]">
          {renderNodes(node.content, ctx)}
        </ul>
      );
    case 'orderedList':
      return (
        <ol
          start={Number(node.attrs?.start) || 1}
          className="my-2.5 list-decimal space-y-1 pl-5 text-[14.5px] leading-[1.7] text-[#404040] marker:text-[#a3a3a3]"
        >
          {renderNodes(node.content, ctx)}
        </ol>
      );
    case 'listItem':
      return <li className="[&>p]:my-0">{renderNodes(node.content, ctx)}</li>;
    case 'taskList':
      return <ul className="my-2.5 space-y-1.5">{renderNodes(node.content, ctx)}</ul>;
    case 'taskItem':
      return (
        <li className="flex items-start gap-2 text-[14.5px] leading-[1.7] text-[#404040]">
          <input
            type="checkbox"
            checked={!!node.attrs?.checked}
            readOnly
            className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded border-[#d4d4d4] accent-[#0a0a0a]"
          />
          <span className="min-w-0 flex-1 [&>p]:my-0">{renderNodes(node.content, ctx)}</span>
        </li>
      );
    case 'blockquote':
      return (
        <blockquote className="my-3 border-l-[3px] border-[#E7E7EA] pl-4 text-[14.5px] italic leading-[1.7] text-[#525252]">
          {renderNodes(node.content, ctx)}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre className="my-3 overflow-x-auto rounded-lg bg-[#09090B] px-3.5 py-3 text-[13px] leading-relaxed text-[#F5F5F6]">
          <code>{renderNodes(node.content, ctx)}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr className="my-6 border-t border-[#E7E7EA]" />;
    case 'hardBreak':
      return <br />;
    case 'image': {
      const src = safeUrl(node.attrs?.src);
      if (!src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={node.attrs?.alt ?? ''}
          className="my-4 block max-h-[520px] w-full rounded-xl border border-[#E7E7EA] object-contain"
        />
      );
    }
    case 'doc':
      return renderNodes(node.content, ctx);
    default:
      // Unknown node — render its children rather than dropping the content.
      return node.content ? renderNodes(node.content, ctx) : null;
  }
}

/**
 * Render a text block's stored content. Handles the Tiptap doc the admin
 * editor writes today, plus the two legacy shapes the SOP editor produced
 * before it (a bare string, or `{ text }`).
 */
export function RichText({ content, blockId = 'x' }: { content: unknown; blockId?: string }) {
  if (content == null) return null;
  if (typeof content === 'string') {
    return content.trim() ? (
      <p className="my-2.5 whitespace-pre-wrap text-[14.5px] leading-[1.75] text-[#404040]">
        {content}
      </p>
    ) : null;
  }
  const doc = content as TiptapNode;
  if (typeof doc.text === 'string' && !doc.content) {
    return (
      <p className="my-2.5 whitespace-pre-wrap text-[14.5px] leading-[1.75] text-[#404040]">
        {doc.text}
      </p>
    );
  }
  return (
    <div className="[&>*:first-child]:mt-0">
      {renderNode(doc, { blockId, headingIndex: 0 })}
    </div>
  );
}

/* ================================================================== */
/* Blocks                                                             */
/* ================================================================== */

function Caption({ text }: { text?: string | null }) {
  if (!text) return null;
  return <figcaption className="mt-2 text-center text-[12px] text-[#737373]">{text}</figcaption>;
}

function Missing({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E7E7EA] bg-[#FAFAFA] px-4 py-6 text-center text-[13px] text-[#a3a3a3]">
      {children}
    </div>
  );
}

export function ContentBlockView({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'text':
      return <RichText content={block.text_content} blockId={block.id} />;

    case 'image': {
      const src = safeUrl(block.file_url);
      if (!src) return <Missing>Missing image</Missing>;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={block.caption ?? ''}
            className="max-h-[560px] w-full rounded-xl border border-[#E7E7EA] bg-white object-contain"
          />
          <Caption text={block.caption} />
        </figure>
      );
    }

    case 'video_embed': {
      const src = safeUrl(block.embed_url);
      if (!src) return <Missing>Missing video link</Missing>;
      return (
        <figure>
          <div className="aspect-video overflow-hidden rounded-xl bg-[#09090B]">
            <iframe
              src={videoEmbedUrl(src)}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
            />
          </div>
          <Caption text={block.caption} />
        </figure>
      );
    }

    case 'video_upload': {
      const src = safeUrl(block.file_url);
      if (!src) return <Missing>Missing video</Missing>;
      return (
        <figure>
          <video
            src={src}
            controls
            className="w-full rounded-xl border border-[#E7E7EA] bg-black"
          />
          <Caption text={block.caption} />
        </figure>
      );
    }

    case 'audio': {
      const src = safeUrl(block.file_url);
      if (!src) return <Missing>Missing audio</Missing>;
      return (
        <figure className="rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] px-3 py-3">
          <audio src={src} controls className="w-full" />
          {block.caption && (
            <figcaption className="mt-1.5 text-[12px] text-[#737373]">{block.caption}</figcaption>
          )}
        </figure>
      );
    }

    case 'pdf': {
      const src = safeUrl(block.file_url);
      if (!src) return <Missing>Missing PDF</Missing>;
      return (
        <figure>
          <div className="flex items-center justify-between gap-2 rounded-t-xl border border-[#E7E7EA] bg-[#FAFAFA] px-3 py-2">
            <span className="truncate text-[13px] font-medium text-[#0a0a0a]">
              {block.file_name || 'Document.pdf'}
            </span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-[#E7E7EA] bg-white px-2.5 py-1 text-[12px] font-medium text-[#525252] transition hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            >
              Open
            </a>
          </div>
          <iframe
            src={src}
            title={block.file_name || 'PDF'}
            className="h-[520px] w-full rounded-b-xl border border-t-0 border-[#E7E7EA] bg-white"
          />
          <Caption text={block.caption} />
        </figure>
      );
    }

    default:
      return null;
  }
}

export interface OutlineHeading {
  id: string;
  text: string;
  level: number;
}

/**
 * Headings across a set of text blocks, in reading order — the "On this page"
 * outline. Walks the stored Tiptap JSON in the same order the renderer does,
 * so every returned id matches a rendered element.
 */
export function collectHeadings(blocks: ContentBlock[] | undefined): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  for (const block of [...(blocks ?? [])].sort((a, b) => a.position - b.position)) {
    if (block.type !== 'text') continue;
    let index = 0;
    const walk = (node: TiptapNode | undefined) => {
      if (!node) return;
      if (node.type === 'heading') {
        const text = nodeText(node).trim();
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2));
        const id = headingAnchorId(block.id, index++);
        if (text) out.push({ id, text, level });
        return;
      }
      (node.content ?? []).forEach(walk);
    };
    const doc = block.text_content;
    if (doc && typeof doc === 'object') walk(doc as TiptapNode);
  }
  return out;
}

function nodeText(node: TiptapNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join('');
}

/** Ordered list of blocks — the body of a lesson or an SOP page. */
export default function ContentBlocks({
  blocks,
  className = 'space-y-5',
}: {
  blocks: ContentBlock[] | undefined;
  className?: string;
}) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className={className}>
      {[...blocks]
        .sort((a, b) => a.position - b.position)
        .map((block) => (
          <ContentBlockView key={block.id} block={block} />
        ))}
    </div>
  );
}
