// Server Component — no 'use client'.
// Composes the full-screen layout: static sidebar shell + interactive editor.
// The editor is a Client Component; this page is the server-rendered wrapper.
import Sidebar from '@/components/Sidebar'
import Editor from '@/components/Editor'

export default function Home() {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        <Editor />
      </main>
    </div>
  )
}
