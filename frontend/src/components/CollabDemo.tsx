'use client'

import { useState } from 'react'
import * as Y from 'yjs'
import CollabEditor from './CollabEditor'

export default function CollabDemo() {
  // Lazy initializer: runs once per mount, not on every render.
  // Both editors share this single Y.Doc — mutations in one propagate to the other
  // via Yjs's in-memory event system (no WebSocket yet).
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc())

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="px-6 py-3 bg-white border-b">
        <h1 className="text-lg font-semibold text-gray-800">CP2 — CRDT Demo</h1>
        <p className="text-sm text-gray-500">
          Two editors, one Y.Doc. Type in either pane — changes sync instantly, no server.
        </p>
      </div>
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        <CollabEditor ydoc={ydoc} side="left" />
        <CollabEditor ydoc={ydoc} side="right" />
      </div>
    </div>
  )
}
