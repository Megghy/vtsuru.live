import type { ShortcutEvent } from '@tauri-apps/plugin-global-shortcut'
import { nanoid } from 'nanoid'
import { ref, watch } from 'vue'

import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { GLOBAL_SHORTCUT_MIN_CLIENT_VERSION, isClientAtLeast } from '@/shared/config/clientVersion'
import { createOwnedShortcuts } from '@/shared/helpers/ownedShortcuts'

import type { VtsConfig } from './config'
import type { VtsConnection } from './connection'
import type { VtsOperations } from './operations'
import type { VtsDeckActionType, VtsDeckTile } from './schemas'

/** 旧版独立「全局快捷键」列表, 已并入操作台格子 */
interface LegacyShortcutBinding {
  label: string
  shortcut: string
  actionType: 'hotkey' | 'macro' | 'preset' | 'panic-calibrate' | 'panic-reset'
  targetId: string
}
const LEGACY_SHORTCUTS_KEY = 'vts.shortcuts'
const LEGACY_TYPE_MAP: Record<LegacyShortcutBinding['actionType'], VtsDeckActionType> = {
  'hotkey': 'hotkey',
  'macro': 'macro',
  'preset': 'preset',
  'panic-calibrate': 'panicCalibrate',
  'panic-reset': 'panicReset',
}

export function newDeckTile(type: VtsDeckActionType, targetId = '', label = ''): VtsDeckTile {
  return { id: `tile-${nanoid(8)}`, type, targetId, label }
}

export function createVtsDeck(config: VtsConfig, conn: VtsConnection, ops: VtsOperations) {
  const shortcutsSupported = ref(false)
  const deckShortcutError = ref<string | null>(null)
  let shortcuts: ReturnType<typeof createOwnedShortcuts> | undefined

  async function runDeckTile(tile: VtsDeckTile) {
    switch (tile.type) {
      case 'expression':
        return ops.toggleExpression(tile.targetId)
      case 'clearExpressions':
        return ops.clearExpressions()
      case 'hotkey':
        return ops.triggerHotkey(tile.targetId)
      case 'preset':
        return ops.applyPreset(tile.targetId)
      case 'macro':
        return ops.runMacro(tile.targetId)
      case 'accessory': {
        const acc = config.accessories.value.find((a) => a.id === tile.targetId)
        if (!acc) throw new Error('配饰不存在')
        return ops.toggleAccessory(acc.id, !acc.visible)
      }
      case 'dropItem':
        return ops.dropItem(tile.targetId)
      case 'panicCalibrate':
        return ops.panicCalibrate()
      case 'panicReset':
        return ops.panicResetPhysics()
    }
  }

  function isDeckTileActive(tile: VtsDeckTile) {
    if (tile.type === 'expression') return conn.expressions.value.some((e) => e.file === tile.targetId && e.active)
    if (tile.type === 'accessory') return config.accessories.value.some((a) => a.id === tile.targetId && a.visible)
    return false
  }

  async function registerShortcuts(tiles: VtsDeckTile[]) {
    const adapter = await import('@tauri-apps/plugin-global-shortcut')
    shortcuts ??= createOwnedShortcuts(adapter)
    try {
      await shortcuts.replace(
        tiles
          .filter((t) => t.shortcut)
          .map((tile) => ({
            shortcut: tile.shortcut,
            handler: (event: ShortcutEvent) => {
              if (event.state !== 'Pressed') return
              runDeckTile(tile).catch((err) => window.$message?.error(err instanceof Error ? err.message : String(err)))
            },
          })),
      )
      deckShortcutError.value = null
    } catch (err) {
      deckShortcutError.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function migrateLegacyShortcuts() {
    const legacy = useTauriStore().getTarget<LegacyShortcutBinding[]>(LEGACY_SHORTCUTS_KEY)
    const bindings = await legacy.get()
    if (!bindings) return
    const tiles = bindings.map((b) => ({
      ...newDeckTile(LEGACY_TYPE_MAP[b.actionType], b.targetId, b.label),
      shortcut: b.shortcut || undefined,
    }))
    await config.saveDeck([...config.deckTiles.value, ...tiles])
    await legacy.delete()
  }

  async function initDeck() {
    await migrateLegacyShortcuts()
    shortcutsSupported.value = isClientAtLeast(GLOBAL_SHORTCUT_MIN_CLIENT_VERSION)
    if (!shortcutsSupported.value) return
    watch(config.deckTiles, registerShortcuts, { immediate: true })
  }

  /** 把当前模型尚未上架的表情批量加入操作台 */
  async function addExpressionTiles() {
    const existing = new Set(config.deckTiles.value.filter((t) => t.type === 'expression').map((t) => t.targetId))
    const added = conn.expressions.value
      .filter((e) => !existing.has(e.file))
      .map((e) => newDeckTile('expression', e.file, e.name))
    await config.saveDeck([...config.deckTiles.value, ...added])
    return added.length
  }

  return {
    shortcutsSupported,
    deckShortcutError,
    initDeck,
    runDeckTile,
    isDeckTileActive,
    addExpressionTiles,
  }
}
