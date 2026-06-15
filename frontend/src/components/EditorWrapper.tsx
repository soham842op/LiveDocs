'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Editor as TiptapEditor } from '@tiptap/core'
import SuggestionsPanel from './SuggestionsPanel'
import InconsistenciesPanel from './InconsistenciesPanel'
import QAPanel from './QAPanel'
import { useAuth } from '@/context/AuthContext'
import { extractSections } from '@/lib/extract-sections'

const Editor = dynamic(() => import('./Editor'), { ssr: false })

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Suggestion = { option: string; rationale: string }

type Tab = 'suggestions' | 'check' | 'ask'

const TABS: { id: Tab; label: string }[] = [
  { id: 'suggestions', label: 'Suggest' },
  { id: 'check',       label: 'Check'   },
  { id: 'ask',         label: 'Ask'     },
]

interface EditorWrapperProps { docId: string }

export default function EditorWrapper({ docId }: EditorWrapperProps) {
  const { token } = useAuth()
  const editorRef = useRef<TiptapEditor | null>(null)
  const abortRef  = useRef<AbortController | null>(null)

  const [activeTab, setActiveTab]     = useState<Tab>('suggestions')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]         = useState(false)

  const handleEditorReady = useCallback((editor: TiptapEditor) => {
    editorRef.current = editor
  }, [])

  const getSections = useCallback(() => {
    const json = editorRef.current?.getJSON()
    return json ? extractSections(json) : []
  }, [])

  const handleTextChange = useCallback(async (text: string) => {
    // Only fire suggestions when that tab is active
    if (activeTab !== 'suggestions') return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSuggestions([])
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
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[suggest]', err)
      }
    } finally {
      setLoading(false)
    }
  }, [docId, token, activeTab])

  const handleAccept = useCallback((suggestion: Suggestion) => {
    editorRef.current?.chain().focus().insertContent(' ' + suggestion.option).run()
    setSuggestions([])
  }, [])

  const handleDismiss = useCallback((index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden">
      <Editor
        docId={docId}
        onTextChange={handleTextChange}
        onEditorReady={handleEditorReady}
      />

      {/* Right panel — always visible, tabs switch the content */}
      <div className="flex flex-col w-72 flex-shrink-0 border-l border-[#3a3a3a] bg-[#252525] overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[#3a3a3a] flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                activeTab === t.id
                  ? 'text-[#4fb3f6] border-b-2 border-[#0078d4]'
                  : 'text-[#666] hover:text-[#cccccc] hover:bg-[#2f2f2f]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'suggestions' && (
            <SuggestionsPanel
              suggestions={suggestions}
              loading={loading}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          )}
          {activeTab === 'check' && (
            <InconsistenciesPanel
              docId={docId}
              token={token}
              getSections={getSections}
            />
          )}
          {activeTab === 'ask' && (
            <QAPanel
              docId={docId}
              token={token}
              getSections={getSections}
            />
          )}
        </div>
      </div>
    </div>
  )
}
