'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Toolbar from './Toolbar'

const SYNC_SERVER = process.env.NEXT_PUBLIC_SYNC_SERVER || 'ws://localhost:1234'

interface EditorProps {
  docId: string
}

export default function Editor({ docId }: EditorProps) {
  // docId is the Postgres UUID for this document.
  // It doubles as the y-websocket room name AND the S3 key prefix on the sync server.
  // This means the room name, DB row, and S3 object are all keyed by the same identifier.
  const ydocRef = useRef<Y.Doc | null>(null)
  if (ydocRef.current === null) {
    ydocRef.current = new Y.Doc()
  }

  const providerRef = useRef<WebsocketProvider | null>(null)
  if (providerRef.current === null) {
    providerRef.current = new WebsocketProvider(SYNC_SERVER, docId, ydocRef.current)
  }

  useEffect(() => {
    return () => {
      providerRef.current?.destroy()
      ydocRef.current?.destroy()
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
