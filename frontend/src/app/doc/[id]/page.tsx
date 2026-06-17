'use client'

// Document editor page — client component for auth check + FastAPI fetch.
// useParams() replaces the server-component `await params` pattern from CP4.

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth, apiFetch } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'
import EditorWrapper from '@/components/EditorWrapper'

type Doc = { id: string; title: string; updated_at: string }

export default function DocPage() {
  const { token, mounted } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [doc, setDoc] = useState<Doc | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [importContent, setImportContent] = useState<string | null>(null)

  useEffect(() => {
    if (!mounted) return
    if (!token) { router.replace('/login'); return }

    apiFetch(`/documents/${id}`, token)
      .then((d: Doc) => {
        setDoc(d)
        const pending = sessionStorage.getItem(`import:${d.id}`)
        if (pending) {
          setImportContent(pending)
          sessionStorage.removeItem(`import:${d.id}`)
        }
      })
      .catch(() => setAccessDenied(true))
  }, [token, mounted, id, router])

  if (!mounted || !token) return null

  if (accessDenied) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1f1f1f] text-[#888] text-sm">
        Document not found or you don&apos;t have access.
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        {doc && (
          <EditorWrapper
            key={doc.id}
            docId={doc.id}
            title={doc.title}
            importContent={importContent}
          />
        )}
      </main>
    </div>
  )
}
