import {
  ArrowDownToLine,
  Crosshair,
  Eraser,
  Glasses,
  Keyboard,
  Palette,
  RotateCcw,
  Smile,
  Sparkles,
  Video,
  Workflow,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed } from 'vue'

import type { VtsDeckActionType } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

export const DECK_TYPE_META: Record<VtsDeckActionType, { label: string; icon: Component; needsTarget: boolean }> = {
  expression: { label: '切换表情', icon: Smile, needsTarget: true },
  clearExpressions: { label: '清除所有表情', icon: Eraser, needsTarget: false },
  hotkey: { label: '触发热键', icon: Keyboard, needsTarget: true },
  preset: { label: '机位预设', icon: Video, needsTarget: true },
  macro: { label: '运行宏', icon: Workflow, needsTarget: true },
  accessory: { label: '切换配饰', icon: Glasses, needsTarget: true },
  dropItem: { label: '掉落道具', icon: ArrowDownToLine, needsTarget: true },
  colorTint: { label: '模型染色', icon: Palette, needsTarget: true },
  postProcessing: { label: '后处理滤镜', icon: Sparkles, needsTarget: true },
  panicCalibrate: { label: '一键校准', icon: Crosshair, needsTarget: false },
  panicReset: { label: '重置物理', icon: RotateCcw, needsTarget: false },
}

/** 把 keydown 转成 Tauri global-shortcut 可解析的字符串, 如 Ctrl+Shift+Digit1; 仅按修饰键时返回 null */
export function shortcutFromEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
  return [...mods, e.code].join('+')
}

type TargetOption = { label: string; value: string }

/** 各动作类型可选的目标; 连接 VTS 后表情/热键/道具/滤镜才有数据 */
export function useDeckTargets() {
  const vts = useVtsStore()
  const options = computed<Partial<Record<VtsDeckActionType, TargetOption[]>>>(() => ({
    expression: vts.expressions.map((e) => ({ label: e.name, value: e.file })),
    hotkey: vts.hotkeys.map((h) => ({ label: h.name || h.hotkeyID, value: h.hotkeyID })),
    preset: vts.presets.map((p) => ({ label: p.name, value: p.id })),
    macro: vts.macros.map((m) => ({ label: m.name, value: m.id })),
    accessory: vts.accessories.map((a) => ({ label: a.name, value: a.id })),
    dropItem: vts.availableItemFiles.map((f) => ({ label: f.fileName, value: f.fileName })),
    colorTint: [
      { label: '恢复原色', value: 'reset' },
      { label: '彩虹循环', value: 'rainbow' },
    ],
    postProcessing: [
      { label: '关闭滤镜', value: '__off__' },
      ...(vts.postProcessing?.presets ?? []).map((p) => ({ label: p, value: p })),
    ],
  }))

  /** 目标在当前数据中不存在 (如换了模型); 模型相关数据仅在已连接时判断 */
  function isTargetMissing(type: VtsDeckActionType, targetId: string) {
    if (!DECK_TYPE_META[type].needsTarget) return false
    if (type === 'colorTint') return !targetId
    const modelBound = type === 'expression' || type === 'hotkey' || type === 'dropItem' || type === 'postProcessing'
    if (modelBound && !vts.connected) return false
    if (type === 'dropItem' && vts.availableItemFiles.length === 0) return false
    if (type === 'postProcessing' && targetId === '__off__') return false
    if (type === 'postProcessing' && !vts.postProcessing) return false
    return !options.value[type]?.some((o) => o.value === targetId)
  }

  return { options, isTargetMissing }
}
