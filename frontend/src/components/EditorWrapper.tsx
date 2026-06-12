'use client'

import dynamic from 'next/dynamic'

// ssr: false must live in a Client Component in Next.js App Router.
// This wrapper applies that constraint while keeping doc/[id]/page.tsx a Server Component.
const Editor = dynamic(() => import('./Editor'), { ssr: false })

interface EditorWrapperProps {
  docId: string
}

export default function EditorWrapper({ docId }: EditorWrapperProps) {
  return <Editor docId={docId} />
}
