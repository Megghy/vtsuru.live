<script setup lang="ts">
import { NAlert, NButton, NCard, NDivider, NFlex, NInput, NPopconfirm, NSelect, NText } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isTauri } from '@/shared/config'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useVtsShortcuts } from './useVtsShortcuts'
import type { VtsShortcutBinding } from './useVtsShortcuts'
import { useVtsAction } from './useVtsAction'

const REQUIRED_VERSION = '0.1.8'

const vts = useVtsStore()
const shortcuts = useVtsShortcuts()
const { run } = useVtsAction()
const router = useRouter()

const clientVersion = ref<string | null>(null)
const versionTooLow = ref(false)

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

async function checkVersion() {
  if (!isTauri()) return
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    clientVersion.value = await getVersion()
    versionTooLow.value = compareVersions(clientVersion.value, REQUIRED_VERSION) < 0
  } catch {
    versionTooLow.value = false
  }
}

const actionTypeOptions = [
  { label: '触发热键', value: 'hotkey' },
  { label: '运行宏', value: 'macro' },
  { label: '切换预设', value: 'preset' },
  { label: '一键校准', value: 'panic-calibrate' },
  { label: '重置物理', value: 'panic-reset' },
]

const hotkeyOptions = computed(() => vts.hotkeys.map(h => ({ label: h.name || h.hotkeyID, value: h.hotkeyID })))
const macroOptions = computed(() => vts.macros.map(m => ({ label: m.name, value: m.id })))
const presetOptions = computed(() => vts.presets.map(p => ({ label: p.name, value: p.id })))

function getTargetOptions(type: string) {
  if (type === 'hotkey') return hotkeyOptions.value
  if (type === 'macro') return macroOptions.value
  if (type === 'preset') return presetOptions.value
  return []
}

function needsTarget(type: string) {
  return ['hotkey', 'macro', 'preset'].includes(type)
}

onMounted(async () => {
  await checkVersion()
  if (versionTooLow.value) return
  await shortcuts.init()
  shortcuts.onAction((binding) => {
    if (!vts.canOperate) return
    if (binding.actionType === 'hotkey') run(() => vts.triggerHotkey(binding.targetId))
    else if (binding.actionType === 'macro') run(() => vts.runMacro(binding.targetId))
    else if (binding.actionType === 'preset') run(() => vts.applyPreset(binding.targetId))
    else if (binding.actionType === 'panic-calibrate') run(() => vts.panicCalibrate())
    else if (binding.actionType === 'panic-reset') run(() => vts.panicResetPhysics())
  })
})

onUnmounted(() => shortcuts.cleanup())
</script>

<template>
  <NCard size="small" title="全局快捷键">
    <template v-if="versionTooLow">
      <NAlert type="warning" :show-icon="true">
        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NText>
            客户端版本过低 (当前 {{ clientVersion }}，需要 {{ REQUIRED_VERSION }}+)，请更新后使用
          </NText>
          <NButton size="small" @click="router.push({ name: 'client-settings' })">
            前往设置更新
          </NButton>
        </NFlex>
      </NAlert>
    </template>

    <NFlex v-else vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" @click="shortcuts.addBinding({ label: '', shortcut: '', actionType: 'hotkey', targetId: '' })">
          添加快捷键
        </NButton>
        <NText depth="3">窗口失焦时也能触发，适合直播中快速操作</NText>
      </NFlex>

      <NDivider v-if="shortcuts.bindings.value.length > 0" style="margin: 4px 0" />

      <NFlex v-for="b in shortcuts.bindings.value" :key="b.id" align="center" justify="space-between" :wrap="true" :size="8">
        <NFlex align="center" :wrap="true" :size="8">
          <NInput
            :value="b.shortcut"
            placeholder="如 Ctrl+Shift+1"
            style="width: 160px"
            @update:value="(v) => shortcuts.updateBinding(b.id, { shortcut: v })"
          />
          <NSelect
            :value="b.actionType"
            :options="actionTypeOptions"
            style="width: 130px"
            size="small"
            @update:value="(v) => shortcuts.updateBinding(b.id, { actionType: v as VtsShortcutBinding['actionType'], targetId: '' })"
          />
          <NSelect
            v-if="needsTarget(b.actionType)"
            :value="b.targetId"
            :options="getTargetOptions(b.actionType)"
            placeholder="选择目标"
            style="width: 220px"
            size="small"
            filterable
            @update:value="(v) => shortcuts.updateBinding(b.id, { targetId: v as string })"
          />
          <NInput
            :value="b.label"
            placeholder="备注 (可选)"
            style="width: 120px"
            @update:value="(v) => shortcuts.updateBinding(b.id, { label: v })"
          />
        </NFlex>
        <NPopconfirm @positive-click="shortcuts.removeBinding(b.id)">
          <template #trigger>
            <NButton size="small" type="error">删除</NButton>
          </template>
          确认删除?
        </NPopconfirm>
      </NFlex>
    </NFlex>
  </NCard>
</template>
