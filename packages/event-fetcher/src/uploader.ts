import { encodeClientUpload, takeBatch } from './upload'
import type { ClientUploadPayload } from './upload'
import { ErrorCodes, FETCHER_VERSION, isNewerVersion } from './version'

export interface UploadResponse {
  Success: boolean
  Message: string
  Version?: string
  EventCount?: number
}

export interface Uploader {
  flush: () => Promise<boolean>
}

export function createUploader(input: {
  queue: string[]
  errors: Map<string, string>
  invoke: (bytes: Uint8Array) => Promise<UploadResponse>
  onRoomChange: (code: string) => void
  useCookie: () => boolean
  osInfo: string
  version?: string
  sleep?: (ms: number) => Promise<void>
}) {
  let failCount = 0
  let roomCode = ''
  let uploading = false
  const version = input.version ?? FETCHER_VERSION
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

  const uploader: Uploader = {
    async flush() {
      if (uploading) return false
      uploading = true
      let ok = false
      try {
        const batch = takeBatch(input.queue)
        const payload: ClientUploadPayload = {
          Events: batch,
          Error: Object.fromEntries(input.errors),
          CurrentVersion: version,
          OSInfo: input.osInfo,
          UseCookie: input.useCookie(),
        }
        const response = await input.invoke(encodeClientUpload(payload))
        if (!response.Success) return false
        failCount = 0
        input.errors.delete(ErrorCodes.UNABLE_UPLOAD_EVENT)
        if (batch.length > 0) input.queue.splice(0, batch.length)
        if (roomCode && response.Message && response.Message !== roomCode) input.onRoomChange(response.Message)
        else if (response.Version && isNewerVersion(response.Version, version)) {
          input.errors.set(ErrorCodes.NEW_VERSION, `发现新版本: ${response.Version}`)
        } else input.errors.delete(ErrorCodes.NEW_VERSION)
        if (response.Message) roomCode = response.Message
        ok = true
      } catch {
        failCount += 1
        if (failCount > 5) input.errors.set(ErrorCodes.UNABLE_UPLOAD_EVENT, '无法发送事件, 请检查网络情况')
      } finally {
        uploading = false
      }
      if (ok && input.queue.length > 0) {
        await sleep(450)
        await uploader.flush()
      }
      return ok
    },
  }
  return uploader
}

export function shouldUpload(queueLength: number, elapsedMs: number, emptyIntervalMs = 60_000) {
  return queueLength > 0 || elapsedMs >= emptyIntervalMs
}
