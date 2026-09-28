import { nanoid } from 'nanoid'
import { VTubeStudioError } from 'vtubestudio'
import { ref } from 'vue'

import { useTauriStore } from '@/apps/client/store/useTauriStore'

export type VtsOpKind =
  | 'connect'
  | 'disconnect'
  | 'hotkeyTrigger'
  | 'expressionSet'
  | 'moveModel'
  | 'injectParam'
  | 'itemLoad'
  | 'itemUnload'
  | 'itemOpacity'
  | 'dropItem'
  | 'macroRun'

export interface VtsOpRecord {
  id: string
  ts: number
  kind: VtsOpKind
  ok: boolean
  detail?: string
  durationMs?: number
  error?: string
  errorCode?: string
  payload?: unknown
}

const HISTORY_LIMIT = 200

function normalizeOpError(err: unknown): { error: string; errorCode?: string } {
  if (err instanceof VTubeStudioError) {
    const errorID = (err.data as { errorID?: number | string } | undefined)?.errorID
    return { error: err.message, errorCode: `VTS_API:${errorID ?? 'UNKNOWN'}` }
  }
  if (err instanceof Error) {
    return { error: err.message, errorCode: err.message.includes('WebSocket') ? 'WS' : undefined }
  }
  return { error: String(err), errorCode: 'UNKNOWN' }
}

export function createVtsHistory() {
  const target = useTauriStore().getTarget<VtsOpRecord[]>('vts.history', [])
  const history = ref<VtsOpRecord[]>([])

  function push(record: Omit<VtsOpRecord, 'id' | 'ts'>) {
    history.value = [{ id: `vtsop-${nanoid(10)}`, ts: Date.now(), ...record }, ...history.value].slice(0, HISTORY_LIMIT)
    void target.set(history.value)
  }

  async function withHistory<T>(kind: VtsOpKind, detail: string | undefined, fn: () => Promise<T>, payload?: unknown) {
    const started = Date.now()
    try {
      const result = await fn()
      push({ kind, ok: true, detail, durationMs: Date.now() - started, payload })
      return result
    } catch (err) {
      push({ kind, ok: false, detail, durationMs: Date.now() - started, payload, ...normalizeOpError(err) })
      throw err
    }
  }

  return {
    history,
    withHistory,
    async loadHistory() {
      history.value = (await target.get()) ?? []
    },
    async clearHistory() {
      history.value = []
      await target.set([])
    },
  }
}

export type VtsHistory = ReturnType<typeof createVtsHistory>
