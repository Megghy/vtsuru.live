<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VtsDeckActionType, VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

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
  <Dialog
    :open="show"
    @update:open="(val) => show = val"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">
          {{ vts.deckTiles.some((t) => t.id === form.id) ? '编辑格子' : '添加格子' }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2 text-xs">
        <div class="flex items-center gap-3">
          <label class="w-16 font-medium text-[var(--muted-foreground)]">动作</label>
          <div class="flex-1">
            <Select
              :model-value="form.type"
              @update:model-value="(val) => setType(val as VtsDeckActionType)"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="选择动作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in typeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          v-if="meta.needsTarget"
          class="flex items-center gap-3"
        >
          <label class="w-16 font-medium text-[var(--muted-foreground)]">目标</label>
          <div class="flex-1">
            <Select
              :model-value="form.targetId || '__none__'"
              @update:model-value="(val) => setTarget(val === '__none__' ? '' : String(val))"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue :placeholder="targetOptions.length ? '选择目标' : '暂无可选项（需连接 VTS）'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未选择</SelectItem>
                <SelectItem
                  v-for="opt in targetOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <label class="w-16 font-medium text-[var(--muted-foreground)]">名称</label>
          <Input
            v-model="form.label"
            class="flex-1 h-8 text-xs"
            placeholder="显示在格子上的文字"
            maxlength="16"
          />
        </div>

        <div class="flex items-center gap-3">
          <label class="w-16 font-medium text-[var(--muted-foreground)]">颜色</label>
          <div class="flex items-center gap-2 flex-1">
            <ColorPicker
              :model-value="form.color ?? ''"
              @update:model-value="(v: string) => (form.color = v || undefined)"
            />
            <Button
              v-if="form.color"
              size="sm"
              variant="ghost"
              class="h-7 text-xs px-2"
              @click="form.color = undefined"
            >
              清除
            </Button>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <label class="w-16 font-medium text-[var(--muted-foreground)] pt-1.5">快捷键</label>
          <div class="flex flex-col gap-1 flex-1">
            <Input
              :value="recording ? '请按下组合键…（Esc 清除）' : form.shortcut ?? ''"
              readonly
              class="h-8 text-xs cursor-pointer"
              :disabled="!vts.shortcutsSupported"
              :placeholder="vts.shortcutsSupported ? '点击后按下组合键，如 Ctrl+Shift+1' : '当前客户端版本不支持全局快捷键'"
              @focus="recording = true"
              @blur="recording = false"
              @keydown="onShortcutKeydown"
            />
            <span class="text-[11px] text-[var(--muted-foreground)]">
              全局生效，客户端在后台时也能触发
            </span>
          </div>
        </div>
      </div>

      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          @click="show = false"
        >
          取消
        </Button>
        <Button
          size="sm"
          :disabled="!canSave"
          @click="save"
        >
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
