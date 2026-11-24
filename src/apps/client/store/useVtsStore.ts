import { acceptHMRUpdate, defineStore } from 'pinia'
import { toast } from 'vue-sonner'

import { createVtsConfig } from './vts/config'
import { createVtsConnection } from './vts/connection'
import { createVtsDeck } from './vts/deck'
import { createVtsHistory } from './vts/history'
import { startVtsObsLink } from './vts/obsLink'
import { createVtsOperations } from './vts/operations'

export type {
  VtsArtMeshInfo,
  VtsAvailableModel,
  VtsExpression,
  VtsFolderInfo,
  VtsInputParameter,
  VtsModelClickEvent,
  VtsNdiState,
  VtsPhysicsGroup,
  VtsPhysicsState,
  VtsPostProcessingState,
} from './vts/connection'
export { VTS_OP_KIND_LABELS, type VtsOpKind, type VtsOpRecord } from './vts/history'
export type * from './vts/schemas'

export const useVtsStore = defineStore('vts', () => {
  const history = createVtsHistory()
  const config = createVtsConfig()
  const connection = createVtsConnection(config, history)
  // 底层 API 通道只给内部模块用, 不暴露给组件
  const {
    request: _request,
    call: _call,
    waitForItemEvent: _wait,
    onSessionReady: _onReady,
    onSessionReset: _onReset,
    onModelLoaded: _onModelLoaded,
    ...conn
  } = connection
  const ops = createVtsOperations(config, connection, history)
  const deck = createVtsDeck(config, connection, ops)

  // 模型切换时若存在绑定该模型且开启自动切换的 Profile，自动应用
  connection.onModelLoaded(async (modelId) => {
    const matched = config.profiles.value.find((p) => p.modelId === modelId && p.autoApplyOnModelLoad)
    if (!matched || config.currentProfileId.value === matched.id) return
    await config.applyProfile(matched.id)
    toast.info(`已自动切换配置方案：${matched.name}`)
  })

  let initPromise: Promise<void> | undefined

  /** 应用启动时调用一次: 加载配置, 常驻 OBS 联动与操作台快捷键, 有 token 时自动连接 */
  async function init() {
    initPromise ??= (async () => {
      await Promise.all([config.loadConfig(), history.loadHistory()])
      startVtsObsLink(config, connection, ops)
      await deck.initDeck()
      if (config.authToken.value) await conn.connect()
    })()
    return initPromise
  }

  async function dispose() {
    ops.stopMacro()
    await ops.stopAllParamHolds()
    await deck.disposeDeck()
    await conn.disconnect(false)
  }

  return { ...history, ...config, ...conn, ...ops, ...deck, init, dispose }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVtsStore, import.meta.hot))
