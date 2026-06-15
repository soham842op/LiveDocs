'use client'

import { type Editor } from '@tiptap/react'

type Props = { editor: Editor | null }

type ButtonProps = {
  onClick: () => void
  isActive: boolean
  label: string
  title: string
}

const FONTS = [
  { label: 'Default',          value: '' },
  { label: 'Arial',            value: 'Arial, sans-serif' },
  { label: 'Georgia',          value: 'Georgia, serif' },
  { label: 'Times New Roman',  value: "'Times New Roman', serif" },
  { label: 'Courier New',      value: "'Courier New', monospace" },
  { label: 'Verdana',          value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS',     value: "'Trebuchet MS', sans-serif" },
  { label: 'Garamond',         value: 'Garamond, serif' },
]

const SIZES = ['8pt','9pt','10pt','11pt','12pt','14pt','16pt','18pt','20pt','24pt','28pt','36pt','48pt','72pt']

function ToolbarButton({ onClick, isActive, label, title }: ButtonProps) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      aria-pressed={isActive}
      className={`
        px-2.5 py-1 rounded text-sm font-medium transition-colors
        ${isActive
          ? 'bg-[#0078d4] text-white'
          : 'text-[#cccccc] hover:bg-[#3a3a3a] hover:text-white'}
      `}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-[#3a3a3a] mx-1" />
}

const selectClass = 'text-xs bg-[#3a3a3a] text-[#e0e0e0] border border-[#555] rounded px-1.5 py-1 outline-none cursor-pointer hover:border-[#888] transition-colors'

export default function Toolbar({ editor }: Props) {
  if (!editor) return null

  const currentFont = editor.getAttributes('fontFamily').fontFamily || ''
  const currentSize = editor.getAttributes('fontSize').fontSize || ''

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-[#3a3a3a] bg-[#2b2b2b] sticky top-0 z-10">
      {/* Font family */}
      <select
        value={currentFont}
        onChange={(e) => {
          e.target.value
            ? editor.chain().focus().setFontFamily(e.target.value).run()
            : editor.chain().focus().unsetFontFamily().run()
        }}
        className={`${selectClass} w-36`}
        style={{ fontFamily: currentFont || 'inherit' }}
        title="Font family"
      >
        {FONTS.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={currentSize}
        onChange={(e) => {
          e.target.value
            ? editor.chain().focus().setFontSize(e.target.value).run()
            : editor.chain().focus().unsetFontSize().run()
        }}
        className={`${selectClass} w-16`}
        title="Font size"
      >
        <option value="">Size</option>
        {SIZES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Divider />

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
