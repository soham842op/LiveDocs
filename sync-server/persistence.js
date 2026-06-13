'use strict'

// CP4: Yjs Persistence Adapter — S3 (binary content) + Postgres (metadata/reference)
//
// Contract with y-websocket:
//   setPersistence({ bindState, writeState }) is called once at startup (global registration).
//
//   bindState(docName, ydoc)  — called when a room opens. Load the saved snapshot into ydoc,
//                               then register the debounced update listener (this is where
//                               ongoing durability comes from — NOT from writeState).
//
//   writeState(docName, ydoc) — called when the last client leaves (room GC). Cancel any
//                               pending debounce and do a final flush. Guards against the
//                               case where the debounce hasn't fired yet when the room closes.
//
// Why we need the debounced update listener AND writeState:
//   writeState only fires on clean disconnect. A server crash with a client still connected
//   would skip it entirely. The update listener is the real durability mechanism — it fires
//   every DEBOUNCE_MS regardless of connection state.

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Pool } = require('pg')
const Y = require('yjs')

const DEBOUNCE_MS = 3000

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.on('error', (err) => {
  console.error('[persistence] Postgres pool error:', err.message)
})

function s3KeyFor(docName) {
  return `snapshots/${docName}.bin`
}

// Load the Yjs snapshot for docName from S3.
// Returns a Buffer (the encoded Yjs state update) or null if no snapshot exists.
async function loadSnapshot(docName) {
  const result = await pool.query(
    'SELECT s3_key FROM document_snapshots WHERE doc_id = $1',
    [docName]
  )
  if (result.rows.length === 0) return null

  const key = result.rows[0].s3_key
  const response = await s3.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  }))

  const chunks = []
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// Save the full current Yjs state to S3 and upsert the reference row in Postgres.
// Also bumps documents.updated_at so the frontend list stays sorted correctly.
async function saveSnapshot(docName, ydoc) {
  const key = s3KeyFor(docName)
  const update = Y.encodeStateAsUpdate(ydoc)

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: update,
    ContentType: 'application/octet-stream',
  }))

  await pool.query(
    `INSERT INTO document_snapshots (doc_id, s3_key, saved_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (doc_id) DO UPDATE SET s3_key = $2, saved_at = NOW()`,
    [docName, key]
  )

  await pool.query(
    'UPDATE documents SET updated_at = NOW() WHERE id = $1',
    [docName]
  )
}

// Build and return the persistence object registered via setPersistence().
// Called once at server startup.
function makePersistence() {
  // Per-room debounce timers. Key = docName, value = setTimeout handle.
  const debounceTimers = new Map()

  async function flush(docName, ydoc) {
    try {
      await saveSnapshot(docName, ydoc)
      console.log(`[persistence] Saved "${docName}" to S3`)
    } catch (err) {
      console.error(`[persistence] Save failed for "${docName}":`, err.message)
    }
  }

  return {
    bindState: async (docName, ydoc) => {
      // 1. Load existing snapshot and apply it to the fresh in-memory ydoc.
      try {
        const buffer = await loadSnapshot(docName)
        if (buffer) {
          Y.applyUpdate(ydoc, buffer)
          console.log(`[persistence] Loaded "${docName}" from S3`)
        } else {
          console.log(`[persistence] No snapshot for "${docName}" — starting fresh`)
        }
      } catch (err) {
        console.error(`[persistence] Load failed for "${docName}":`, err.message)
      }

      // 2. Register debounced save on every future CRDT update.
      //    This is what makes persistence durable between clean disconnects.
      ydoc.on('update', () => {
        const existing = debounceTimers.get(docName)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(() => {
          debounceTimers.delete(docName)
          flush(docName, ydoc)
        }, DEBOUNCE_MS)

        debounceTimers.set(docName, timer)
      })
    },

    writeState: async (docName, ydoc) => {
      // Cancel the pending debounce (if any) and do an immediate final save.
      const existing = debounceTimers.get(docName)
      if (existing) {
        clearTimeout(existing)
        debounceTimers.delete(docName)
      }
      await flush(docName, ydoc)
    },
  }
}

module.exports = { makePersistence, pool }
