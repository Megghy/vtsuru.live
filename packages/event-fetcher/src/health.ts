import { createServer } from 'node:http'

export function startHealthServer(port: number) {
  const server = createServer((_, response) => {
    response.statusCode = 200
    response.end('VTsuruEventFetcher')
  })
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}
