// index.ts
import { connectRedis } from './lib/redis.js'
import { createServer } from 'http'

// Initialize Sentry BEFORE loading any application modules
import { initSentry } from './utils/sentry.js';
await initSentry();

async function main() {
  // 1. Konek Redis DULU, tungguin sampai beneran sukses
  await connectRedis()

  // 2. BARU kita load app dan kawan-kawannya (mereka aman sekarang karena Redis udah nyala)
  const { default: app } = await import('./app.js')
  const { initializeRedisBridge } = await import('./network/redisBridge.js')
  const { startMessageSweeper } = await import('./jobs/messageSweeper.js')
  const { startSystemSweeper } = await import('./jobs/systemSweeper.js')

  const httpServer = createServer(app)

  await initializeRedisBridge()
  startMessageSweeper()
  startSystemSweeper()

  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
