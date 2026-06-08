'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Toolbar from './Toolbar'

export default function Editor() {
  // immediatelyRender: false — required for Next.js App Router.
  //
  // TipTap mounts a ProseMirror view onto a DOM node inside useEffect.
  // On the server there is no DOM, so the editor must start as null and only
  // initialise after the component hydrates on the client. Without this flag,
  // the server HTML and the client's first render diverge, causing a React
  // hydration error.
  //
  // The return type becomes Editor | null when this flag is set, so we check
  // for null before rendering the Toolbar.
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your document…',
      }),
    ],
    editorProps: {
      attributes: {
        // This class name is picked up by the .tiptap ruleset in globals.css,
        // which applies heading/list/emphasis styles inside the contenteditable.
        class: 'tiptap max-w-prose mx-auto py-8 px-4',
      },
    },
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <Toolbar editor={editor} />
      {/*
        EditorContent renders a div > div[contenteditable].
        The outer div here gets overflow-y-auto so the editor area scrolls
        independently of the sidebar while the toolbar stays sticky at the top.
      */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto"
      />
    </div>
  )
}
