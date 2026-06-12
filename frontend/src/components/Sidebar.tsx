'use client'

// Sidebar is a Client Component because:
//   1. usePathname() (to highlight the active doc) is client-only.
//   2. The New Document button calls a server action + router.push, which needs useRouter.
//
// Docs are fetched server-side by each page (Server Component) and passed as props.
// This keeps the data fetch on the server while letting the sidebar respond to navigation.

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { createDocument } from '@/app/actions'
import type { Doc } from '@/lib/supabase'

interface SidebarProps {
  docs: Doc[]
}

export default function Sidebar({ docs }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleNewDoc() {
    startTransition(async () => {
      const { id } = await createDocument()
      router.push(`/doc/${id}`)
    })
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900 text-base tracking-tight">LiveDocs</h1>
        <button
          onClick={handleNewDoc}
          disabled={isPending}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          title="New document"
        >
          {isPending ? '…' : '+ New'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">
          Documents
        </p>

        {docs.length === 0 && (
          <p className="text-xs text-gray-400 px-2">No documents yet</p>
        )}

        <div className="space-y-0.5">
          {docs.map((doc) => {
            const isActive = pathname === `/doc/${doc.id}`
            return (
              <a
                key={doc.id}
                href={`/doc/${doc.id}`}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <DocIcon />
                <span className="truncate">{doc.title}</span>
              </a>
            )
          })}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">CP4 — persistence</p>
      </div>
    </aside>
  )
}

function DocIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
      />
    </svg>
  )
}
