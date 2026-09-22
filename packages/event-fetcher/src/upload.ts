import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'

import { encode, decode } from '@msgpack/msgpack'

export const MAX_BATCH_EVENTS = 150

export interface ClientUploadPayload {
  Events: string[]
  Error: Record<string, string>
  CurrentVersion: string | null
  OSInfo: string
  UseCookie: boolean
}

export function encodeClientUpload(payload: ClientUploadPayload) {
  return brotliCompressSync(encode(payload))
}

export function decodeClientUpload(bytes: Uint8Array): ClientUploadPayload {
  return decode(brotliDecompressSync(bytes)) as ClientUploadPayload
}

export function takeBatch<T>(items: T[], limit = MAX_BATCH_EVENTS) {
  return items.slice(0, limit)
}
