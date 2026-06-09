import Sidebar from '@/components/Sidebar'
import EditorWrapper from '@/components/EditorWrapper'

export default function Home() {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        <EditorWrapper />
      </main>
    </div>
  )
}
