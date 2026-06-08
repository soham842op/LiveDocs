'use client'

import { type Editor } from '@tiptap/react'

type Props = { editor: Editor | null }

type ButtonProps = {
  onClick: () => void
  isActive: boolean
  label: string
  title: string
}

function ToolbarButton({ onClick, isActive, label, title }: ButtonProps) {
  return (
    <button
      onMouseDown={(e) => {
        // Prevent the editor from losing focus on toolbar click
        e.preventDefault()
        onClick()
      }}
      title={title}
      aria-pressed={isActive}
      className={`
        px-2.5 py-1 rounded text-sm font-medium transition-colors
        ${isActive
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
      `}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />
}

export default function Toolbar({ editor }: Props) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        label="B"
        title="Bold (Ctrl+B)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        label="I"
        title="Italic (Ctrl+I)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        label="S̶"
        title="Strikethrough"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        label="H1"
        title="Heading 1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        label="H2"
        title="Heading 2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        label="H3"
        title="Heading 3"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        label="• List"
        title="Bullet list"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        label="1. List"
        title="Ordered list"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        label="❝"
        title="Blockquote"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        label="</>"
        title="Code block"
      />
    </div>
  )
}
