'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

interface Props {
  ydoc: Y.Doc
  side: 'left' | 'right'
}

export default function CollabEditor({ ydoc, side }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // undoRedo: false because the Collaboration extension installs yUndoPlugin
      // which replaces ProseMirror's native history. Running both causes double-undo bugs.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap h-full p-6 focus:outline-none',
      },
    },
  })

  return (
    <div className="flex flex-col flex-1 border rounded-lg overflow-hidden bg-white">
      <div className="px-4 py-2 bg-gray-50 border-b text-xs font-mono text-gray-500 uppercase tracking-wide">
        {side} editor
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
