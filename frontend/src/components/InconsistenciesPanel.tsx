'use client'

import { useState } from 'react'
import type { Section } from '@/lib/extract-sections'

type Finding = {
  section_a: number
  section_b: number
  description: string
  severity: 'high' | 'medium' | 'low'
}

const severityStyle: Record<string, string> = {
  high:   'text-[#f87171] bg-[#3a1a1a] border-[#7f1d1d]',
  medium: 'text-[#fb923c] bg-[#2d1f0f] border-[#7c2d12]',
  low:    'text-[#facc15] bg-[#2a2210] border-[#713f12]',
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Props {
  docId: string
  token: string | null
  getSections: () => Section[]
}

export default function InconsistenciesPanel({ docId, token, getSections }: Props) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    const sections = getSections()
    if (!sections.length) return
    setLoading(true)
    setError(null)
    setChecked(false)
    try {
      const res = await fetch(`${API}/inconsistencies/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sections }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFindings(data.findings ?? [])
      setChecked(true)
    } catch {
      setError('Check failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        onClick={check}
        disabled={loading}
        className="w-full py-2 rounded text-sm font-medium bg-[#0078d4] text-white disabled:opacity-50 hover:bg-[#106ebe] transition-colors"
      >
        {loading ? 'Analysing…' : 'Check for Inconsistencies'}
      </button>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {checked && findings.length === 0 && (
        <p className="text-xs text-[#555] text-center mt-4">No inconsistencies found.</p>
      )}

      <div className="flex flex-col gap-3">
        {findings.map((f, i) => (
          <div
            key={i}
            className={`rounded border p-3 text-xs ${severityStyle[f.severity] ?? severityStyle.low}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold uppercase text-[10px] tracking-wider">
                {f.severity}
              </span>
              <span className="opacity-60">§{f.section_a} ↔ §{f.section_b}</span>
            </div>
            <p className="leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
