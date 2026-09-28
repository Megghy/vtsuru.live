<script setup lang="ts">
import { NButton, NColorPicker, NFlex, NForm, NFormItem, NInput, NModal, NSelect, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import type { VtsDeckActionType, VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { DECK_TYPE_META, shortcutFromEvent, useDeckTargets } from './deckMeta'
import { useVtsAction } from './useVtsAction'

const props = defineProps<{ tile: VtsDeckTile }>()
const show = defineModel<boolean>('show', { required: true })

const vts = useVtsStore()
const { run } = useVtsAction()
const { options } = useDeckTargets()
const form = ref<VtsDeckTile>({ ...props.tile })
const recording = ref(false)

watch(show, (visible) => {
  if (!visible) return
  form.value = { ...props.tile }
  recording.value = false
  if (vts.connected && vts.availableItemFiles.length === 0) void run(() => vts.refreshItems())
})

const typeOptions = Object.entries(DECK_TYPE_META).map(([value, meta]) => ({ label: meta.label, value }))
const meta = computed(() => DECK_TYPE_META[form.value.type])
const targetOptions = computed(() => options.value[form.value.type] ?? [])

function setType(type: VtsDeckActionType) {
  form.value = { ...form.value, type, targetId: '', label: DECK_TYPE_META[type].needsTarget ? '' : DECK_TYPE_META[type].label }
}

function setTarget(targetId: string) {
  const label = targetOptions.value.find((o) => o.value === targetId)?.label ?? ''
  form.value = { ...form.value, targetId, label: form.value.label || label }
}

function onShortcutKeydown(e: KeyboardEvent) {
  e.preventDefault()
  if (e.key === 'Escape' || e.key === 'Backspace') {
    form.value.shortcut = undefined
    recording.value = false
    return
  }
  const shortcut = shortcutFromEvent(e)
  if (!shortcut) return
  form.value.shortcut = shortcut
  recording.value = false
}

const canSave = computed(() => form.value.label.trim() && (!meta.value.needsTarget || form.value.targetId))

function save() {
  void run(async () => {
    const { id, shortcut } = form.value
    const clash = shortcut && vts.deckTiles.find((t) => t.id !== id && t.shortcut === shortcut)
    if (clash) throw new Error(`快捷键 ${shortcut} 已被「${clash.label}」使用`)
    await vts.upsertDeckTile({ ...form.value, label: form.value.label.trim(), color: form.value.color || undefined })
    show.value = false
  })
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="vts.deckTiles.some((t) => t.id === form.id) ? '编辑格子' : '添加格子'"
    style="width: 480px"
  >
    <NForm
      label-placement="left"
      label-width="72"
    >
      <NFormItem label="动作">
        <NSelect
          :value="form.type"
          :options="typeOptions"
          @update:value="setType"
        />
      </NFormItem>
      <NFormItem
        v-if="meta.needsTarget"
        label="目标"
      >
        <NSelect
          :value="form.targetId || null"
          :options="targetOptions"
          filterable
          tag
          :placeholder="targetOptions.length ? '选择目标' : '暂无可选项（表情/热键/道具需先连接 VTS）'"
          @update:value="setTarget"
        />
      </NFormItem>
      <NFormItem label="名称">
        <NInput
          v-model:value="form.label"
          placeholder="显示在格子上的文字"
          maxlength="16"
        />
      </NFormItem>
      <NFormItem label="颜色">
        <NColorPicker
          :value="form.color ?? null"
          :modes="['hex']"
          :show-alpha="false"
          clearable
          @update:value="(v: string | null) => (form.color = v ?? undefined)"
        />
      </NFormItem>
      <NFormItem label="快捷键">
        <NFlex
          vertical
          :size="4"
          style="width: 100%"
        >
          <NInput
            :value="recording ? '请按下组合键…（Esc 清除）' : form.shortcut ?? ''"
            readonly
            :disabled="!vts.shortcutsSupported"
            :placeholder="vts.shortcutsSupported ? '点击后按下组合键，如 Ctrl+Shift+1' : '当前客户端版本不支持全局快捷键'"
            @focus="recording = true"
            @blur="recording = false"
            @keydown="onShortcutKeydown"
          />
          <NText
            depth="3"
            style="font-size: 12px"
          >
            全局生效，客户端在后台时也能触发
          </NText>
        </NFlex>
      </NFormItem>
    </NForm>
    <template #footer>
      <NFlex justify="end">
        <NButton @click="show = false"> 取消 </NButton>
        <NButton
          type="primary"
          :disabled="!canSave"
          @click="save"
        >
          保存
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>
