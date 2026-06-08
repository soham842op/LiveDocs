// Node y-websocket sync server — stub for CP1.
// Real Yjs room management and persistence start in CP3 and CP4.
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', checkpoint: 1 }))
})

const PORT = process.env.PORT || 1234
server.listen(PORT, () => {
  console.log(`Sync server stub listening on port ${PORT}`)
})
