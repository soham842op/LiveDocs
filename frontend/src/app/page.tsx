import { listDocuments } from '@/lib/documents'
import Sidebar from '@/components/Sidebar'

// Server Component — fetches the doc list at request time, passes to the Client Sidebar.
// No editor here: / is the dashboard. The editor lives at /doc/[id].
export default async function HomePage() {
  const docs = await listDocuments()

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar docs={docs} />
      <main className="flex flex-1 items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-gray-500 text-sm">Select a document from the sidebar</p>
          <p className="text-gray-400 text-xs">or click &ldquo;+ New&rdquo; to create one</p>
        </div>
      </main>
    </div>
  )
}
