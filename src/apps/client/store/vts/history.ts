import { nanoid } from 'nanoid'
import { VTubeStudioError } from 'vtubestudio'
import { ref } from 'vue'

import { useTauriStore } from '@/apps/client/store/useTauriStore'

export type VtsOpKind =
  | 'connect'
  | 'disconnect'
  | 'modelLoad'
  | 'hotkeyTrigger'
  | 'expressionSet'
  | 'moveModel'
  | 'injectParam'
  | 'itemLoad'
  | 'itemUnload'
  | 'itemOpacity'
  | 'itemPin'
  | 'dropItem'
  | 'colorTint'
  | 'postProcessing'
  | 'macroRun'

export const VTS_OP_KIND_LABELS: Record<VtsOpKind, string> = {
  connect: '连接 VTS',
  disconnect: '断开连接',
  modelLoad: '切换模型',
  hotkeyTrigger: '触发热键',
  expressionSet: '切换表情',
  moveModel: '移动机位',
  injectParam: '注入参数',
  itemLoad: '加载道具',
  itemUnload: '卸载道具',
  itemOpacity: '道具显隐',
  itemPin: '道具钉选',
  dropItem: '掉落道具',
  colorTint: '模型染色',
  postProcessing: '后处理滤镜',
  macroRun: '运行宏',
}

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
