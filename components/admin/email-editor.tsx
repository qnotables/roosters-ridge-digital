"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailEditor({
  html,
  onChange,
  disabled = false,
}: {
  html: string;
  onChange: (html: string, text: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        heading: { levels: [2, 3] },
      }),
    ],
    content: html,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-56 p-4 outline-none text-sm leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:underline [&_p]:mb-3",
        role: "textbox",
        "aria-label": "Rich-text message",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== html)
      editor.commands.setContent(html, { emitUpdate: false });
  }, [html, editor]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);
  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div
        className="flex flex-wrap gap-1 border-b border-border p-2"
        role="toolbar"
        aria-label="Message formatting"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bold"
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Italic"
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bullet list"
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Numbered list"
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
