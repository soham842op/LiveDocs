'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Toolbar from './Toolbar'
import { useAuth } from '@/context/AuthContext'
import { FontFamily, FontSize } from '@/lib/tiptap-extensions'

const SYNC_SERVER = process.env.NEXT_PUBLIC_SYNC_SERVER || 'ws://localhost:1234'

interface EditorProps {
  docId: string
  onTextChange?: (text: string) => void
  onEditorReady?: (editor: TiptapEditor) => void
}

export default function Editor({ docId, onTextChange, onEditorReady }: EditorProps) {
  // By the time Editor mounts, the parent page has already confirmed token is set
  // (it renders null until mounted && token are both truthy). Safe to read here.
  const { token } = useAuth()

  const ydocRef = useRef<Y.Doc | null>(null)
  if (ydocRef.current === null) {
    ydocRef.current = new Y.Doc()
  }

  const providerRef = useRef<WebsocketProvider | null>(null)
  if (providerRef.current === null) {
    // Pass token as a URL query param — y-websocket v3 appends params to the WS URL.
    // The sync server reads ?token= before calling setupWSConnection.
    // (Browser WS API has no custom headers, so query params are the standard workaround.)
    providerRef.current = new WebsocketProvider(SYNC_SERVER, docId, ydocRef.current, {
      params: token ? { token } : {},
    })
  }

  // Keep a ref to the latest onTextChange so the editor update listener
  // never closes over a stale prop without recreating the listener.
  const onTextChangeRef = useRef(onTextChange)
  useEffect(() => { onTextChangeRef.current = onTextChange }, [onTextChange])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [lineCount, setLineCount] = useState(0)

  useEffect(() => {
    return () => {
      providerRef.current?.destroy()
      ydocRef.current?.destroy()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydocRef.current }),
      Placeholder.configure({ placeholder: 'Start writing your document…' }),
      FontFamily,
      FontSize,
    ],
    editorProps: {
      attributes: { class: 'tiptap max-w-2xl mx-auto px-16 py-12 bg-white border border-[#888] shadow-[0_4px_32px_rgba(0,0,0,0.55)] min-h-[calc(100vh-8rem)]' },
    },
  })

  useEffect(() => {
    if (!editor) return
    onEditorReady?.(editor)
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      const text = editor.getText()
      setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length)
      setLineCount(editor.state.doc.childCount)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const paraText = editor.state.selection.$anchor.parent.textContent
        if (paraText.trim()) onTextChangeRef.current?.(paraText)
      }, 1500)
    }
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor])

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1f1f1f]">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto bg-[#1f1f1f] py-10" />
      <div className="border-t border-[#3a3a3a] px-6 py-1.5 flex gap-5 text-xs text-[#666] select-none bg-[#1f1f1f]">
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
      </div>
    </div>
  )
}
