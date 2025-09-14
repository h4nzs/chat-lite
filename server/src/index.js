import http from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import app from './app.js'
import { env } from './config.js'
import { registerSocket } from './socket.js'

const server = http.createServer(app)
const io = new SocketIOServer(server, {
  cors: { origin: env.corsOrigin, credentials: true }
})

registerSocket(io)

server.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`)
})
