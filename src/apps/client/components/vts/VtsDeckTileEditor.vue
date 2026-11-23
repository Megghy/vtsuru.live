<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VtsDeckActionType, VtsDeckTile } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { DECK_TYPE_META, shortcutFromEvent, useDeckTargets } from './deckMeta'
import { useVtsAction } from './useVtsAction'

const props = defineProps<{ tile: VtsDeckTile }>()
const show = defineModel<boolean>('show', { required: true })

const vts = useVtsStore()
const { run } = useVtsAction()
const { options } = useDeckTargets()
const form = ref<VtsDeckTile>({ ...props.tile })
const recording = ref(false)
const labelTouched = ref(false)

const existingGroups = computed(() => {
  const set = new Set<string>()
  for (const t of vts.deckTiles) {
    const g = t.group?.trim()
    if (g) set.add(g)
  }
  return [...set]
})

watch(show, (visible) => {
  if (!visible) return
  form.value = { ...props.tile }
  recording.value = false
  labelTouched.value = Boolean(props.tile.label)
  if (vts.connected && vts.availableItemFiles.length === 0) void run(() => vts.refreshItems())
})

const typeOptions = Object.entries(DECK_TYPE_META).map(([value, meta]) => ({ label: meta.label, value }))
const meta = computed(() => DECK_TYPE_META[form.value.type])
const targetOptions = computed(() => options.value[form.value.type] ?? [])

const tintMode = computed<'color' | 'rainbow' | 'reset'>({
  get: () => {
    if (form.value.targetId === 'reset') return 'reset'
    if (form.value.targetId === 'rainbow') return 'rainbow'
    return 'color'
  },
  set: (mode) => {
    if (mode === 'reset') {
      form.value.targetId = 'reset'
      if (!labelTouched.value) form.value.label = '恢复原色'
    } else if (mode === 'rainbow') {
      form.value.targetId = 'rainbow'
      if (!labelTouched.value) form.value.label = '彩虹染色'
    } else {
      form.value.targetId = form.value.targetId?.startsWith('#') ? form.value.targetId : '#ff6b9d'
      if (!labelTouched.value) form.value.label = '模型染色'
    }
  },
})

function setType(type: VtsDeckActionType) {
  labelTouched.value = false
  const nextTarget = type === 'colorTint' ? '#ff6b9d' : ''
  form.value = {
    ...form.value,
    type,
    targetId: nextTarget,
    label: DECK_TYPE_META[type].needsTarget ? (type === 'colorTint' ? '模型染色' : '') : DECK_TYPE_META[type].label,
  }
}

function setTarget(targetId: string) {
  const label = targetOptions.value.find((o) => o.value === targetId)?.label ?? ''
  form.value = {
    ...form.value,
    targetId,
    label: labelTouched.value ? form.value.label : label,
  }
}

function onShortcutKeydown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
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

const canSave = computed(() => Boolean(form.value.label.trim() && (!meta.value.needsTarget || form.value.targetId)))

function save() {
  void run(async () => {
    const { id, shortcut } = form.value
    const clash = shortcut && vts.deckTiles.find((t) => t.id !== id && t.shortcut === shortcut)
    if (clash) throw new Error(`快捷键 ${shortcut} 已被「${clash.label}」使用`)
    await vts.upsertDeckTile({
      ...form.value,
      label: form.value.label.trim(),
      color: form.value.color || undefined,
      group: form.value.group?.trim() || undefined,
    })
    show.value = false
  })
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="(val) => (show = val)"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base">
          {{ vts.deckTiles.some((t) => t.id === form.id) ? '编辑格子' : '添加格子' }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <FormField label="动作">
          <Select
            :model-value="form.type"
            @update:model-value="(val) => setType(val as VtsDeckActionType)"
          >
            <SelectTrigger class="w-full">
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
        </FormField>

        <!-- 染色专属目标配置 -->
        <template v-if="form.type === 'colorTint'">
          <FormField label="染色模式">
            <ToggleGroup
              type="single"
              class="w-full grid grid-cols-3"
              :model-value="tintMode"
              @update:model-value="(v) => v && (tintMode = v as 'color' | 'rainbow' | 'reset')"
            >
              <ToggleGroupItem value="color">指定颜色</ToggleGroupItem>
              <ToggleGroupItem value="rainbow">彩虹循环</ToggleGroupItem>
              <ToggleGroupItem value="reset">恢复原色</ToggleGroupItem>
            </ToggleGroup>
          </FormField>
          <FormField
            v-if="tintMode === 'color'"
            label="染色颜色"
          >
            <ColorPicker
              :model-value="form.targetId.startsWith('#') ? form.targetId : '#ff6b9d'"
              @update:model-value="(v: string) => (form.targetId = v || '#ff6b9d')"
            />
          </FormField>
        </template>

        <!-- 常规目标选择 -->
        <FormField
          v-else-if="meta.needsTarget"
          label="目标"
        >
          <Select
            :model-value="form.targetId || '__none__'"
            @update:model-value="(val) => setTarget(val === '__none__' ? '' : String(val))"
          >
            <SelectTrigger class="w-full">
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
        </FormField>

        <div class="grid grid-cols-2 gap-2.5">
          <FormField
            label="名称"
            class="min-w-0"
          >
            <Input
              v-model="form.label"
              placeholder="显示在格子上的文字"
              maxlength="16"
              @input="labelTouched = true"
            />
          </FormField>

          <FormField
            label="分组（可选）"
            class="min-w-0"
          >
            <Input
              v-model="form.group"
              placeholder="如 表情 / 机位 / 整活"
              maxlength="12"
            />
          </FormField>
        </div>

        <div
          v-if="existingGroups.length > 0"
          class="flex items-center gap-1.5 flex-wrap"
        >
          <span class="text-[11px] text-muted-foreground">已有分组:</span>
          <Button
            v-for="g in existingGroups"
            :key="g"
            size="xs"
            :variant="form.group === g ? 'secondary' : 'outline'"
            @click="form.group = form.group === g ? '' : g"
          >
            {{ g }}
          </Button>
        </div>

        <FormField label="强调色">
          <div class="flex items-center gap-2">
            <ColorPicker
              :model-value="form.color ?? ''"
              @update:model-value="(v: string) => (form.color = v || undefined)"
            />
            <Button
              v-if="form.color"
              variant="ghost"
              class="px-2"
              @click="form.color = undefined"
            >
              清除
            </Button>
          </div>
        </FormField>

        <FormField
          label="全局快捷键"
          description="全局生效，客户端在后台时也能触发（按 Esc / Backspace 清除）"
        >
          <Input
            :model-value="recording ? '请按下组合键…（Esc 清除）' : (form.shortcut ?? '')"
            readonly
            class="cursor-pointer"
            :disabled="!vts.shortcutsSupported"
            :placeholder="
              vts.shortcutsSupported ? '点击后按下组合键，如 Ctrl+Shift+1' : '当前客户端版本不支持全局快捷键'
            "
            @focus="recording = true"
            @blur="recording = false"
            @keydown="onShortcutKeydown"
          />
        </FormField>
      </div>

      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          @click="show = false"
        >
          取消
        </Button>
        <Button
          :disabled="!canSave"
          @click="save"
        >
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
