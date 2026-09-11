'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';

/**
 * Notion-style editor for a lesson's text blocks.
 *
 * The JSON it produces is stored verbatim in `training_lesson_blocks.text_content`
 * and rendered on the talent side by `components/training/ContentBlocks` — keep
 * the two schemas in step when adding an extension here.
 */
export function editorExtensions() {
  return [
    StarterKit.configure({
      // Links are inserted from the toolbar, so clicking one inside the editor
      // should place the cursor rather than navigate away.
      link: { openOnClick: false, autolink: true },
      heading: { levels: [1, 2, 3] },
    }),
    Highlight,
    Image,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Write the lesson content…' }),
  ];
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      disabled={disabled}
      // Keep the selection: mousedown would blur the editor before the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-7 min-w-7 rounded px-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
        active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-200" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (leave empty to remove)', previous ?? 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert('Links must start with http:// or https://');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
      <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
      <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
      <Divider />
      <ToolbarButton title="Bold" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}><span className="font-bold">B</span></ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}><span className="italic">I</span></ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}><span className="underline">U</span></ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}><span className="line-through">S</span></ToolbarButton>
      <ToolbarButton title="Highlight" active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}>▮</ToolbarButton>
      <ToolbarButton title="Inline code" active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}>{'</>'}</ToolbarButton>
      <Divider />
      <ToolbarButton title="Bulleted list" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>•—</ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
      <ToolbarButton title="Checklist" active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</ToolbarButton>
      <ToolbarButton title="Quote" active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
      <ToolbarButton title="Code block" active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</ToolbarButton>
      <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>
      <Divider />
      <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>🔗</ToolbarButton>
      <ToolbarButton title="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>✕</ToolbarButton>
      <Divider />
      <ToolbarButton title="Undo" disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
      <ToolbarButton title="Redo" disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  onBlur,
}: {
  content: unknown;
  /** Fires on every keystroke — debounce or save on blur, don't PUT per change. */
  onChange?: (json: unknown) => void;
  onBlur?: (json: unknown) => void;
}) {
  const editor = useEditor({
    extensions: editorExtensions(),
    content: (content as any) || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'lesson-prose min-h-[160px] px-3.5 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
    onBlur: ({ editor: e }) => onBlur?.(e.getJSON()),
  });

  // Re-seed when the caller swaps to a different block's content.
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content ?? null);
    if (incoming === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent((content as any) || '', { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, JSON.stringify(content ?? null)]);

  if (!editor) return <div className="h-[200px] animate-pulse rounded-lg bg-gray-100" />;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style jsx global>{`
        .lesson-prose { font-size: 14px; line-height: 1.7; color: #404040; }
        .lesson-prose > *:first-child { margin-top: 0; }
        .lesson-prose h1 { font-size: 1.55em; font-weight: 600; margin: 1.1em 0 0.4em; color: #0a0a0a; letter-spacing: -0.015em; }
        .lesson-prose h2 { font-size: 1.28em; font-weight: 600; margin: 1em 0 0.35em; color: #0a0a0a; letter-spacing: -0.01em; }
        .lesson-prose h3 { font-size: 1.1em; font-weight: 600; margin: 0.9em 0 0.3em; color: #0a0a0a; }
        .lesson-prose p { margin: 0.55em 0; }
        .lesson-prose ul { list-style: disc; padding-left: 1.4em; margin: 0.55em 0; }
        .lesson-prose ol { list-style: decimal; padding-left: 1.4em; margin: 0.55em 0; }
        .lesson-prose li { margin: 0.2em 0; }
        .lesson-prose li::marker { color: #a3a3a3; }
        .lesson-prose blockquote { border-left: 3px solid #e5e7eb; padding-left: 0.9em; color: #525252; font-style: italic; margin: 0.8em 0; }
        .lesson-prose code { background: #f0f0f0; border-radius: 3px; padding: 1px 4px; font-family: ui-monospace, monospace; font-size: 0.9em; }
        .lesson-prose pre { background: #09090b; color: #f5f5f6; border-radius: 8px; padding: 0.75em 0.9em; overflow-x: auto; margin: 0.7em 0; }
        .lesson-prose pre code { background: transparent; color: inherit; padding: 0; }
        .lesson-prose a { color: #2563eb; text-decoration: underline; }
        .lesson-prose mark { background: #fffac2; border-radius: 2px; padding: 0 2px; }
        .lesson-prose hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.3em 0; }
        .lesson-prose img { display: block; max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 10px; margin: 1em auto; }
        .lesson-prose ul[data-type='taskList'] { list-style: none; padding-left: 0.1em; }
        .lesson-prose ul[data-type='taskList'] li { display: flex; gap: 0.5em; align-items: flex-start; }
        .lesson-prose ul[data-type='taskList'] li > div { flex: 1 1 auto; min-width: 0; }
        .lesson-prose ul[data-type='taskList'] li > div > p { margin: 0; }
        .lesson-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none; color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
