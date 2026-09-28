import {
  ArrowDown24Regular,
  ArrowReset24Regular,
  DocumentFlowchart24Regular,
  EmojiSmileSlight24Regular,
  Eraser24Regular,
  Glasses24Regular,
  Keyboard24Regular,
  Target24Regular,
  Video24Regular,
} from '@vicons/fluent'
import type { Component } from 'vue'
import { computed } from 'vue'

import type { VtsDeckActionType } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

export const DECK_TYPE_META: Record<VtsDeckActionType, { label: string; icon: Component; needsTarget: boolean }> = {
  expression: { label: '切换表情', icon: EmojiSmileSlight24Regular, needsTarget: true },
  clearExpressions: { label: '清除所有表情', icon: Eraser24Regular, needsTarget: false },
  hotkey: { label: '触发热键', icon: Keyboard24Regular, needsTarget: true },
  preset: { label: '机位预设', icon: Video24Regular, needsTarget: true },
  macro: { label: '运行宏', icon: DocumentFlowchart24Regular, needsTarget: true },
  accessory: { label: '切换配饰', icon: Glasses24Regular, needsTarget: true },
  dropItem: { label: '掉落道具', icon: ArrowDown24Regular, needsTarget: true },
  panicCalibrate: { label: '一键校准', icon: Target24Regular, needsTarget: false },
  panicReset: { label: '重置物理', icon: ArrowReset24Regular, needsTarget: false },
}

/** 把 keydown 转成 Tauri global-shortcut 可解析的字符串, 如 Ctrl+Shift+Digit1; 仅按修饰键时返回 null */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
  return [...mods, e.code].join('+')
}

type TargetOption = { label: string; value: string }

/** 各动作类型可选的目标; 连接 VTS 后表情/热键/道具才有数据 */
export function useDeckTargets() {
  const vts = useVtsStore()
  const options = computed<Partial<Record<VtsDeckActionType, TargetOption[]>>>(() => ({
    expression: vts.expressions.map((e) => ({ label: e.name, value: e.file })),
    hotkey: vts.hotkeys.map((h) => ({ label: h.name || h.hotkeyID, value: h.hotkeyID })),
    preset: vts.presets.map((p) => ({ label: p.name, value: p.id })),
    macro: vts.macros.map((m) => ({ label: m.name, value: m.id })),
    accessory: vts.accessories.map((a) => ({ label: a.name, value: a.id })),
    dropItem: vts.availableItemFiles.map((f) => ({ label: f.fileName, value: f.fileName })),
  }))

  /** 目标在当前数据中不存在 (如换了模型); 模型相关数据仅在已连接时判断 */
  function isTargetMissing(type: VtsDeckActionType, targetId: string) {
    if (!DECK_TYPE_META[type].needsTarget) return false
    const modelBound = type === 'expression' || type === 'hotkey' || type === 'dropItem'
    if (modelBound && !vts.connected) return false
    if (type === 'dropItem' && vts.availableItemFiles.length === 0) return false
    return !options.value[type]?.some((o) => o.value === targetId)
  }

  return { options, isTargetMissing }
}
