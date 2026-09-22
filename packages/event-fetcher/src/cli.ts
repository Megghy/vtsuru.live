import { existsSync } from 'node:fs'
import { platform, version } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadFetcherSettings, readConfigFile } from './config'
import { startHealthServer } from './health'
import { createSignalRHub } from './hub'
import { startFetcher } from './session'

function configPath() {
  return [join(process.cwd(), 'config.json'), join(dirname(fileURLToPath(import.meta.url)), 'config.json')].find((path) =>
    existsSync(path),
  )
}

const settings = loadFetcherSettings(process.env, readConfigFile(configPath()))
const port = Number(process.env.PORT || 0)
const health = port > 0 ? await startHealthServer(port) : undefined
const running: Array<ReturnType<typeof startFetcher>> = []

for (const [index, token] of settings.tokens.entries()) {
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, 2_000))
  running.push(
    startFetcher(
      {
        token,
        cookie: settings.cookie,
        cookieCloud: settings.cookieCloud,
        apiBaseUrl: settings.apiBaseUrl,
        failoverBaseUrl: settings.failoverBaseUrl,
      },
      {
        connectHub: createSignalRHub,
        osInfo: `${platform()} ${version()}`,
        log: (message) => console.log(`[event-fetcher:${index}] ${message}`),
      },
    ),
  )
}

async function shutdown() {
  await Promise.all(running.map((fetcher) => fetcher.stop()))
  await health?.close()
}

process.on('SIGINT', () => void shutdown().finally(() => process.exit(0)))
process.on('SIGTERM', () => void shutdown().finally(() => process.exit(0)))
