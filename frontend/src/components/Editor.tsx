'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Toolbar from './Toolbar'

const SYNC_SERVER = 'ws://localhost:1234'
const ROOM = 'livedocs-default'

export default function Editor() {
  // Synchronous lazy-ref initialization — safe because:
  // 1. This component is loaded with ssr:false (never runs on the server)
  // 2. reactStrictMode is disabled (no double-mount in dev)
  // So these refs are created exactly once per mount and stay stable.
  const ydocRef = useRef<Y.Doc | null>(null)
  if (ydocRef.current === null) {
    ydocRef.current = new Y.Doc()
  }

  const providerRef = useRef<WebsocketProvider | null>(null)
  if (providerRef.current === null) {
    providerRef.current = new WebsocketProvider(SYNC_SERVER, ROOM, ydocRef.current)
  }

  useEffect(() => {
    return () => {
      providerRef.current?.destroy()
      ydocRef.current?.destroy()
    }
  }, [])

  // useEditor called once with all extensions — no session state, no recreation
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
