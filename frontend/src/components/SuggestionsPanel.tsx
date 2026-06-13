'use client'

interface SuggestionsPanelProps {
  suggestion: string
  loading: boolean
}

export default function SuggestionsPanel({ suggestion, loading }: SuggestionsPanelProps) {
  if (!loading && !suggestion) return null

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
        AI Suggestion
      </h3>
      {loading && !suggestion && (
        <p className="text-sm text-gray-400 italic">Generating…</p>
      )}
      {suggestion && (
        <ol className="space-y-3 list-none">
          {suggestion.split(/(?=\d+\. )/).filter(Boolean).map((item, i) => (
            <li key={i} className="text-sm text-gray-700 leading-relaxed">{item.trim()}</li>
          ))}
        </ol>
      )}
    </div>
  )
}
