'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import * as Y from 'yjs'
import Toolbar from './Toolbar'

export default function Editor() {
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc())

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
      Placeholder.configure({ placeholder: 'Start writing your document…' }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap max-w-prose mx-auto py-8 px-4',
      },
    },
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
