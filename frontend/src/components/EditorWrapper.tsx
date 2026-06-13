'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import SuggestionsPanel from './SuggestionsPanel'
import { useAuth } from '@/context/AuthContext'

// ssr: false must live in a Client Component in Next.js App Router.
// This wrapper applies that constraint while keeping doc/[id]/page.tsx a Server Component.
const Editor = dynamic(() => import('./Editor'), { ssr: false })

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface EditorWrapperProps {
  docId: string
}

export default function EditorWrapper({ docId }: EditorWrapperProps) {
  const { token } = useAuth()
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleTextChange = useCallback(async (text: string) => {
    // Cancel any in-flight stream before starting a new one.
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSuggestion('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, doc_id: docId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // sse-starlette uses \r\n\r\n; normalize to \n\n before splitting.
        buffer = buffer.replace(/\r\n/g, '\n')
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith(':')) continue // sse keepalive comment
            if (line.startsWith('data: ')) {
              setSuggestion(prev => prev + line.slice(6))
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[suggest]', err)
      }
    } finally {
      setLoading(false)
    }
  }, [docId, token])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Editor docId={docId} onTextChange={handleTextChange} />
      <SuggestionsPanel suggestion={suggestion} loading={loading} />
    </div>
  )
}
