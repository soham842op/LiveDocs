'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, apiFetch } from '@/context/AuthContext'

type Doc = { id: string; title: string; updated_at: string }

export default function Sidebar() {
  const { token, user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [isPending, startTransition] = useTransition()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  function fetchDocs() {
    if (!token) return
    apiFetch('/documents', token).then(setDocs).catch(console.error)
  }

  useEffect(() => {
    fetchDocs()
  }, [token, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('docs-changed', fetchDocs)
    return () => window.removeEventListener('docs-changed', fetchDocs)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewDoc() {
    if (!token) return
    startTransition(async () => {
      try {
        const { id } = await apiFetch('/documents', token, { method: 'POST' })
        router.push(`/doc/${id}`)
      } catch (err) {
        console.error('Failed to create document:', err)
      }
    })
  }

  async function handleDelete(docId: string, isActive: boolean) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    if (!token) return
    try {
      await apiFetch(`/documents/${docId}`, token, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== docId))
      if (isActive) router.push('/')
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    const content = await file.text()
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
    try {
      const { id } = await apiFetch('/documents', token, { method: 'POST' })
      await apiFetch(`/documents/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ title: nameWithoutExt }),
      })
      sessionStorage.setItem(`import:${id}`, content)
      router.push(`/doc/${id}`)
    } catch (err) {
      console.error('Upload failed:', err)
    }
    e.target.value = ''
  }

  return (
    <aside className="w-64 shrink-0 border-r border-[#3a3a3a] flex flex-col bg-[#252525] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#3a3a3a] flex items-center justify-between">
        <h1 className="font-semibold text-[#e8e8e8] text-base tracking-tight">LiveDocs</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => uploadRef.current?.click()}
            className="text-xs text-[#666] hover:text-[#cccccc] transition-colors"
            title="Upload document"
          >
            <UploadIcon />
          </button>
          <button
            onClick={handleNewDoc}
            disabled={isPending}
            className="text-xs text-[#4fb3f6] hover:text-white font-medium disabled:opacity-50 transition-colors"
            title="New document"
          >
            {isPending ? '…' : '+ New'}
          </button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[11px] font-semibold text-[#666] uppercase tracking-widest px-2 mb-2">
          Documents
        </p>

        {docs.length === 0 && (
          <p className="text-xs text-[#666] px-2">No documents yet</p>
        )}

        <div className="space-y-0.5">
          {docs.map((doc) => {
            const isActive = pathname === `/doc/${doc.id}`
            return (
              <div
                key={doc.id}
                className="relative group"
                onMouseEnter={() => setHoveredId(doc.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <a
                  href={`/doc/${doc.id}`}
                  className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors pr-8 ${
                    isActive
                      ? 'bg-[#0e3a5c] text-[#4fb3f6] font-medium'
                      : 'text-[#cccccc] hover:bg-[#333333]'
                  }`}
                >
                  <DocIcon />
                  <span className="truncate">{doc.title}</span>
                </a>
                {hoveredId === doc.id && (
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(doc.id, isActive) }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[#555] hover:text-[#e05555] transition-colors rounded"
                    title="Delete document"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[#3a3a3a]">
        {user && (
          <p className="text-xs text-[#888] truncate mb-1" title={user.email}>
            {user.email}
          </p>
        )}
        <button
          onClick={logout}
          className="text-xs text-[#666] hover:text-[#cccccc] transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

function DocIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}
