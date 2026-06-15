import type { JSONContent } from '@tiptap/core'

export type Section = { index: number; text: string; heading: string | null }

function nodeText(node: JSONContent): string {
  if (node.text) return node.text
  return (node.content ?? []).map(nodeText).join('')
}

export function extractSections(doc: JSONContent): Section[] {
  const sections: Section[] = []
  let i = 0
  let currentHeading: string | null = null

  for (const node of doc.content ?? []) {
    if (node.type === 'heading') {
      currentHeading = nodeText(node)
      if (currentHeading.trim()) {
        sections.push({ index: i++, text: currentHeading, heading: null })
      }
    } else {
      const text = nodeText(node)
      if (text.trim()) {
        sections.push({ index: i++, text, heading: currentHeading })
      }
    }
  }

  return sections
}
