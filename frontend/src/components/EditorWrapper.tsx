'use client'

import dynamic from 'next/dynamic'

// ssr: false must live in a Client Component in Next.js App Router.
// This wrapper exists solely to apply that constraint while keeping
// page.tsx a pure Server Component.
const Editor = dynamic(() => import('./Editor'), { ssr: false })

export default Editor
