import { acceptHMRUpdate, defineStore } from 'pinia'

import { createVtsConfig } from './vts/config'
import { createVtsConnection } from './vts/connection'
import { createVtsDeck } from './vts/deck'
import { createVtsHistory } from './vts/history'
import { startVtsObsLink } from './vts/obsLink'
import { createVtsOperations } from './vts/operations'

export type { VtsExpression } from './vts/connection'
export type { VtsOpKind, VtsOpRecord } from './vts/history'
export type * from './vts/schemas'

export const useVtsStore = defineStore('vts', () => {
  const history = createVtsHistory()
  const config = createVtsConfig()
  const connection = createVtsConnection(config, history)
  // 底层 API 通道只给内部模块用, 不暴露给组件
  const { request: _request, call: _call, waitForItemEvent: _wait, ...conn } = connection
  const ops = createVtsOperations(config, connection, history)
  const deck = createVtsDeck(config, connection, ops)

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

  return { ...history, ...config, ...conn, ...ops, ...deck, init }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVtsStore, import.meta.hot))
