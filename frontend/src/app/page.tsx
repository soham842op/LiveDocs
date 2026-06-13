'use client'

// Dashboard — client component so it can read auth state from localStorage
// and redirect unauthenticated users without a server round-trip.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'

export default function HomePage() {
  const { token, mounted } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (mounted && !token) router.replace('/login')
  }, [token, mounted, router])

  // `mounted` is false on first render (before localStorage is read).
  // Rendering null prevents a flash of the page before the redirect fires.
  if (!mounted || !token) return null

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-gray-500 text-sm">Select a document from the sidebar</p>
          <p className="text-gray-400 text-xs">or click &ldquo;+ New&rdquo; to create one</p>
        </div>
      </main>
    </div>
  )
}
