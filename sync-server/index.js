const http = require('http')
const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils')
const { makePersistence, pool } = require('./persistence')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')

setPersistence(makePersistence())

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', checkpoint: 5 }))
})

const wss = new WebSocket.Server({ noServer: true })

// Auth lives in the upgrade handler, not the connection handler.
//
// Why: the connection handler runs AFTER the WS handshake completes.
// The client fires its first Yjs SyncStep1 on socket open (sub-millisecond).
// If we await a DB query inside connection before calling setupWSConnection,
// that SyncStep1 lands while there's no ws.on('message') listener → silently dropped.
// Symptom: existing doc content never loads (server only sends content in reply to SyncStep1).
//
// The upgrade handler fires during the HTTP→WS handshake, before any WS frames
// can arrive. Async work here is safe: reject via HTTP 401/403, or call handleUpgrade
// to promote to a WebSocket (which then fires 'connection' synchronously).
server.on('upgrade', async (req, socket, head) => {
  socket.on('error', (err) => console.error('Socket upgrade error:', err))

  const url = new URL('http://localhost' + (req.url || '/'))
  const docName = url.pathname.slice(1)
  const token = url.searchParams.get('token')

  function reject(status, message) {
    socket.write(`HTTP/1.1 ${status} ${message}\r\n\r\n`)
    socket.destroy()
  }

  if (!token) {
    reject(401, 'Authentication Required')
    return
  }

  let userId
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    userId = payload.sub
  } catch {
    reject(401, 'Invalid Token')
    return
  }

  try {
    const result = await pool.query(
      `SELECT d.id
       FROM documents d
       LEFT JOIN document_collaborators dc ON dc.doc_id = d.id AND dc.user_id = $1::uuid
       WHERE d.id = $2::uuid
         AND (d.owner_id = $1::uuid OR dc.user_id = $1::uuid OR d.owner_id IS NULL)`,
      [userId, docName]
    )
    if (result.rows.length === 0) {
      reject(403, 'Forbidden')
      return
    }
  } catch (err) {
    console.error('[auth] DB check failed:', err.message)
    reject(500, 'Internal Server Error')
    return
  }

  // Auth passed — complete the WebSocket handshake.
  // Pass userId and docName as extra args so the connection handler can log them.
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, userId, docName)
  })
})

// Connection handler is now synchronous — no async work before setupWSConnection.
// Auth was already verified in the upgrade handler above.
wss.on('connection', (ws, req, userId, docName) => {
  console.log(`[${new Date().toISOString()}] Connected — room: "${docName}" user: ${userId} | clients: ${wss.clients.size}`)

  ws.on('close', (code, reason) => {
    console.log(`Disconnected — code: ${code} reason: ${reason?.toString() || 'none'}`)
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
  })

  try {
    setupWSConnection(ws, req)
  } catch (err) {
    console.error('setupWSConnection threw:', err)
  }
})

wss.on('error', (err) => {
  console.error('WSS error:', err)
})

const PORT = process.env.PORT || 1234
server.listen(PORT, () => {
  console.log(`Sync server listening on port ${PORT}`)
})
