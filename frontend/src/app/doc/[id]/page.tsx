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

  useEffect(() => {
    if (!mounted) return
    if (!token) { router.replace('/login'); return }

    apiFetch(`/documents/${id}`, token)
      .then(setDoc)
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
        {doc && <EditorWrapper docId={doc.id} />}
      </main>
    </div>
  )
}
