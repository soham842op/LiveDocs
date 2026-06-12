import { notFound } from 'next/navigation'
import { getDocument, listDocuments } from '@/lib/documents'
import Sidebar from '@/components/Sidebar'
import EditorWrapper from '@/components/EditorWrapper'

// In Next.js 16, params is a Promise — must be awaited before use.
export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch the specific document and the full list in parallel.
  // notFound() renders the 404 page if the document doesn't exist.
  const [doc, docs] = await Promise.all([getDocument(id), listDocuments()])

  if (!doc) notFound()

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar docs={docs} />
      <main className="flex flex-1 overflow-hidden">
        <EditorWrapper docId={doc.id} />
      </main>
    </div>
  )
}
