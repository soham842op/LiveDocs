const http = require('http')
const WebSocket = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', checkpoint: 3 }))
})

const wss = new WebSocket.Server({ noServer: true })

wss.on('connection', (ws, req) => {
  const room = (req.url || '').slice(1).split('?')[0]
  console.log(`[${new Date().toISOString()}] Connected — room: "${room}" | total: ${wss.clients.size}`)

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

server.on('upgrade', (req, socket, head) => {
  socket.on('error', (err) => console.error('Socket upgrade error:', err))
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

const PORT = process.env.PORT || 1234
server.listen(PORT, () => {
  console.log(`Sync server listening on port ${PORT}`)
})
