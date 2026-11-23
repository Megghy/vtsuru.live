import type { ShortcutEvent } from '@tauri-apps/plugin-global-shortcut'
import { nanoid } from 'nanoid'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { isTauri } from '@/shared/config'
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
  hotkey: 'hotkey',
  macro: 'macro',
  preset: 'preset',
  'panic-calibrate': 'panicCalibrate',
  'panic-reset': 'panicReset',
}

export function newDeckTile(type: VtsDeckActionType, targetId = '', label = '', group?: string): VtsDeckTile {
  return { id: `tile-${nanoid(8)}`, type, targetId, label, group }
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
      case 'colorTint': {
        if (tile.targetId === 'reset') return ops.tintModel({ reset: true })
        if (tile.targetId === 'rainbow') return ops.tintModel({ rainbow: true })
        return ops.tintModel({ colorHex: tile.targetId || tile.color || '#ffffff' })
      }
      case 'postProcessing': {
        if (tile.targetId === '__off__') return ops.updatePostProcessing({ enabled: false })
        return ops.updatePostProcessing({ enabled: true, preset: tile.targetId || undefined })
      }
      case 'panicCalibrate':
        return ops.panicCalibrate()
      case 'panicReset':
        return ops.panicResetPhysics()
    }
  }

  function isDeckTileActive(tile: VtsDeckTile) {
    if (tile.type === 'expression') return conn.expressions.value.some((e) => e.file === tile.targetId && e.active)
    if (tile.type === 'accessory') return config.accessories.value.some((a) => a.id === tile.targetId && a.visible)
    if (tile.type === 'postProcessing' && conn.postProcessing.value) {
      if (tile.targetId === '__off__') return !conn.postProcessing.value.active
      return conn.postProcessing.value.active && conn.postProcessing.value.activePreset === tile.targetId
    }
    return false
  }

  async function registerShortcuts(tiles: VtsDeckTile[]) {
    const adapter = await import('@tauri-apps/plugin-global-shortcut')
    shortcuts ??= createOwnedShortcuts(adapter)
    try {
      const failed = await shortcuts.replaceBestEffort(
        tiles
          .filter((t): t is VtsDeckTile & { shortcut: string } => Boolean(t.shortcut))
          .map((tile) => ({
            shortcut: tile.shortcut,
            handler: (event: ShortcutEvent) => {
              if (event.state !== 'Pressed') return
              runDeckTile(tile).catch((err) => toast.error(err instanceof Error ? err.message : String(err)))
            },
          })),
      )
      deckShortcutError.value = failed.length > 0 ? `以下快捷键注册失败：${failed.join('、')}` : null
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
    shortcutsSupported.value = isTauri() && isClientAtLeast(GLOBAL_SHORTCUT_MIN_CLIENT_VERSION)
    if (!shortcutsSupported.value) return
    watch(config.deckTiles, registerShortcuts, { immediate: true })
  }

  async function disposeDeck() {
    await shortcuts?.dispose().catch(() => {})
  }

  async function addDeckTiles(
    items: Array<{ type: VtsDeckActionType; targetId: string; label: string; color?: string; group?: string }>,
  ) {
    const existing = new Set(config.deckTiles.value.map((t) => `${t.type}:${t.targetId}`))
    const added = items
      .filter((item) => !existing.has(`${item.type}:${item.targetId}`))
      .map((item) => ({
        ...newDeckTile(item.type, item.targetId, item.label, item.group),
        color: item.color,
      }))
    if (added.length > 0) {
      await config.saveDeck([...config.deckTiles.value, ...added])
    }
    return added.length
  }

  /** 把当前模型尚未上架的表情批量加入操作台 */
  async function addExpressionTiles(group?: string) {
    return addDeckTiles(
      conn.expressions.value.map((e) => ({
        type: 'expression' as const,
        targetId: e.file,
        label: e.name,
        group,
      })),
    )
  }

  return {
    shortcutsSupported,
    deckShortcutError,
    initDeck,
    disposeDeck,
    runDeckTile,
    isDeckTileActive,
    addDeckTiles,
    addExpressionTiles,
  }
}
