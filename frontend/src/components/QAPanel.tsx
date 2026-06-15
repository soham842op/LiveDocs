'use client'

import { useState } from 'react'
import type { Section } from '@/lib/extract-sections'

type Citation = { index: number; text: string; heading: string | null }
type Status = 'idle' | 'indexing' | 'thinking'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const statusLabel: Record<Status, string> = {
  idle:     'Ask',
  indexing: 'Indexing…',
  thinking: 'Thinking…',
}

interface Props {
  docId: string
  token: string | null
  getSections: () => Section[]
}

export default function QAPanel({ docId, token, getSections }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [citations, setCitations] = useState<Citation[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    if (!question.trim() || status !== 'idle') return
    setError(null)
    setAnswer(null)
    setCitations([])

    setStatus('indexing')
    const sections = getSections()
    try {
      const embedRes = await fetch(`${API}/embed/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sections }),
      })
      if (!embedRes.ok) throw new Error(`embed ${embedRes.status}`)
    } catch {
      setError('Failed to index document.')
      setStatus('idle')
      return
    }

    setStatus('thinking')
    try {
      const qaRes = await fetch(`${API}/qa/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: question.trim() }),
      })
      if (!qaRes.ok) throw new Error(`qa ${qaRes.status}`)
      const data = await qaRes.json()
      setAnswer(data.answer ?? '')
      setCitations(data.citations ?? [])
    } catch {
      setError('Failed to get answer.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() }
        }}
        placeholder="Ask a question about this document…"
        rows={3}
        className="w-full bg-[#2f2f2f] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-[#e0e0e0] placeholder-[#555] outline-none focus:border-[#0078d4] resize-none"
      />
      <button
        onClick={ask}
        disabled={status !== 'idle' || !question.trim()}
        className="w-full py-2 rounded text-sm font-medium bg-[#0078d4] text-white disabled:opacity-50 hover:bg-[#106ebe] transition-colors"
      >
        {statusLabel[status]}
      </button>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {answer !== null && (
        <div className="flex flex-col gap-3">
          <div className="bg-[#2f2f2f] border border-[#3a3a3a] rounded p-3 text-sm text-[#e0e0e0] leading-relaxed">
            {answer}
          </div>
          {citations.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider text-[#555] font-semibold">Sources</p>
              {citations.map((c) => (
                <div key={c.index} className="bg-[#252525] border border-[#3a3a3a] rounded p-2.5 text-xs text-[#888]">
                  {c.heading && (
                    <span className="text-[#666] font-medium block mb-1">{c.heading}</span>
                  )}
                  <span className="line-clamp-3">{c.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
