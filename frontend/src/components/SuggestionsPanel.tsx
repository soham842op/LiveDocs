'use client'

import type { Suggestion } from './EditorWrapper'

interface Props {
  suggestions: Suggestion[]
  loading: boolean
  onAccept: (suggestion: Suggestion) => void
  onDismiss: (index: number) => void
}

export default function SuggestionsPanel({ suggestions, loading, onAccept, onDismiss }: Props) {
  return (
    <div className="p-4">
      {loading && suggestions.length === 0 && (
        <p className="text-sm text-[#666] italic">Generating…</p>
      )}

      {!loading && suggestions.length === 0 && (
        <p className="text-xs text-[#555] text-center mt-6">
          Start writing to get AI suggestions.
        </p>
      )}

      <ol className="space-y-3">
        {suggestions.map((s, i) => (
          <li key={i} className="bg-[#2f2f2f] border border-[#3a3a3a] rounded-lg p-3">
            <p className="text-sm text-[#e0e0e0] leading-relaxed mb-1">{s.option}</p>
            <p className="text-xs text-[#888] mb-3">{s.rationale}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(s)}
                className="flex-1 text-xs font-medium py-1 px-2 rounded bg-[#0078d4] text-white hover:bg-[#106ebe] transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onDismiss(i)}
                className="flex-1 text-xs font-medium py-1 px-2 rounded bg-[#3a3a3a] text-[#aaa] hover:bg-[#444] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
