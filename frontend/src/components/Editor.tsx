'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Toolbar from './Toolbar'
import { useAuth } from '@/context/AuthContext'

const SYNC_SERVER = process.env.NEXT_PUBLIC_SYNC_SERVER || 'ws://localhost:1234'

interface EditorProps {
  docId: string
  onTextChange?: (text: string) => void
}

export default function Editor({ docId, onTextChange }: EditorProps) {
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
    ],
    editorProps: {
      attributes: { class: 'tiptap max-w-prose mx-auto py-8 px-4' },
    },
  })

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const text = editor.state.selection.$anchor.parent.textContent
        if (text.trim()) onTextChangeRef.current?.(text)
      }, 1500)
    }
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor])

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
