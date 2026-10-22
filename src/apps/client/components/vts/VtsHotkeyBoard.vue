<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'

import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import { useVtsAction } from './useVtsAction'
import VtsHotkeyButton from './VtsHotkeyButton.vue'

const props = defineProps<{
  hotkeys: VtsHotkeyInfo[]
  disabled?: boolean
  modelName?: string | null
}>()

const emit = defineEmits<{
  (e: 'trigger', hotkeyID: string): void
  (e: 'refresh'): void
}>()

const vts = useVtsStore()
const { run } = useVtsAction()

const ICON_MAX_BYTES = 200 * 1024
const ARM_TIMEOUT_MS = 1500

const query = ref('')
const groupMode = ref<'flat' | 'type' | 'custom'>('flat')
const safeClick = ref(false)
const armedHotkeyID = ref<string | null>(null)
let armedTimer: number | undefined

const showEdit = ref(false)
const editForm = reactive({ hotkeyID: '', pinned: false, group: '', color: '', displayName: '', iconDataUrl: '' })

const customMap = computed(() => new Map(vts.hotkeyCustomizations.map((h) => [h.hotkeyID, h])))
const deckHotkeyIds = computed(() => new Set(vts.deckTiles.filter((t) => t.type === 'hotkey').map((t) => t.targetId)))

function getCustom(hotkeyID: string) {
  return customMap.value.get(hotkeyID)
}

function openEdit(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  Object.assign(editForm, {
    hotkeyID: hk.hotkeyID,
    pinned: c?.pinned ?? false,
    group: c?.group ?? '',
    color: c?.color ?? '',
    displayName: c?.displayName ?? '',
    iconDataUrl: c?.iconDataUrl ?? '',
  })
  showEdit.value = true
}

function saveCustom(custom: VtsHotkeyCustomization, successMsg?: string) {
  return run(() => vts.setHotkeyCustomization(custom), successMsg)
}

function saveEdit() {
  void saveCustom(
    {
      hotkeyID: editForm.hotkeyID,
      pinned: editForm.pinned || undefined,
      group: editForm.group.trim() || undefined,
      color: editForm.color || undefined,
      displayName: editForm.displayName || undefined,
      iconDataUrl: editForm.iconDataUrl || undefined,
    },
    '已保存',
  )
  showEdit.value = false
}

function clearCustomization() {
  void run(() => vts.removeHotkeyCustomization(editForm.hotkeyID), '已清除自定义')
  showEdit.value = false
}

async function onIconFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await run(async () => {
    if (!file.type.startsWith('image/')) throw new Error('仅支持图片文件')
    if (file.size > ICON_MAX_BYTES) throw new Error('图标过大（>200KB），请换更小的图片')
    editForm.iconDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('读取图标失败'))
      reader.readAsDataURL(file)
    })
  })
}

function togglePinned(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  void saveCustom({ ...c, hotkeyID: hk.hotkeyID, pinned: !c?.pinned || undefined })
}

function addToDeck(hk: VtsHotkeyInfo) {
  const label = getCustom(hk.hotkeyID)?.displayName || hk.name || hk.hotkeyID
  void run(() => vts.upsertDeckTile({ ...newDeckTile('hotkey', hk.hotkeyID, label), color: getCustom(hk.hotkeyID)?.color }), '已加入操作台')
}

function disarm() {
  armedHotkeyID.value = null
  window.clearTimeout(armedTimer)
}

function handleTrigger(hotkeyID: string) {
  if (safeClick.value && armedHotkeyID.value !== hotkeyID) {
    armedHotkeyID.value = hotkeyID
    window.clearTimeout(armedTimer)
    armedTimer = window.setTimeout(disarm, ARM_TIMEOUT_MS)
    return
  }
  disarm()
  emit('trigger', hotkeyID)
}

onUnmounted(disarm)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q
    ? props.hotkeys.filter((h) => [h.name, h.description, h.type].some((s) => s?.toLowerCase().includes(q)))
    : props.hotkeys
  const pinned = (h: VtsHotkeyInfo) => (getCustom(h.hotkeyID)?.pinned ? 1 : 0)
  return list.toSorted((a, b) => pinned(b) - pinned(a) || (a.name || a.hotkeyID).localeCompare(b.name || b.hotkeyID))
})

const groupModeOptions = [
  { label: '平铺', value: 'flat' },
  { label: '按类型', value: 'type' },
  { label: '按自定义组', value: 'custom' },
]

const groups = computed<[string, VtsHotkeyInfo[]][]>(() => {
  if (groupMode.value === 'flat') return [['', filtered.value]]
  const keyOf = (hk: VtsHotkeyInfo) =>
    groupMode.value === 'type' ? hk.type || '未知' : getCustom(hk.hotkeyID)?.group?.trim() || '未分组'
  return [...Map.groupBy(filtered.value, keyOf)].toSorted((a, b) => a[0].localeCompare(b[0]))
})
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">表情与动作热键</CardTitle>
      <div
        v-if="modelName"
        class="text-xs text-muted-foreground"
      >
        当前模型: {{ modelName }}
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <Input v-model="query" placeholder="搜索名称 / 描述 / 类型" class="min-w-[200px] flex-1" />
        <div class="flex items-center gap-1.5 cursor-pointer select-none">
          <Switch :checked="safeClick" @update:checked="safeClick = $event; disarm()" />
          <span class="text-xs text-muted-foreground">防误触</span>
        </div>
        <div class="w-[110px]">
          <Select v-model="groupMode">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in groupModeOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" :disabled="disabled" @click="emit('refresh')">
          刷新
        </Button>
      </div>

      <div
        v-if="safeClick"
        class="text-xs text-muted-foreground"
      >
        防误触已开启：同一按钮需连续点击两次才会触发
      </div>

      <div
        v-if="filtered.length === 0"
        class="py-6 flex flex-col items-center justify-center"
      >
        <Empty :description="disabled ? '连接 VTS 后显示当前模型的热键' : '当前模型没有匹配的热键'" />
      </div>

      <div
        v-for="[key, list] in groups"
        v-else
        :key="key"
        class="space-y-2"
      >
        <template v-if="key">
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs font-semibold text-foreground">{{ key }}</span>
            <span class="text-xs text-muted-foreground">{{ list.length }}</span>
          </div>
          <div class="h-px bg-border my-1" />
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <div
            v-for="hk in list"
            :key="hk.hotkeyID"
          >
            <VtsHotkeyButton
              :hk="hk"
              :custom="getCustom(hk.hotkeyID)"
              :disabled="disabled"
              :armed="safeClick && armedHotkeyID === hk.hotkeyID"
              :on-deck="deckHotkeyIds.has(hk.hotkeyID)"
              @trigger="handleTrigger(hk.hotkeyID)"
              @edit="openEdit(hk)"
              @toggle-pinned="togglePinned(hk)"
              @add-to-deck="addToDeck(hk)"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog v-model:open="showEdit">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">自定义热键外观</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 pt-2 text-xs">
        <div class="text-xs text-muted-foreground">ID: {{ editForm.hotkeyID }}</div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 cursor-pointer select-none">
            <Switch :checked="editForm.pinned" @update:checked="editForm.pinned = $event" />
            <span>置顶</span>
          </div>
          <Input v-model="editForm.group" placeholder="分组" class="flex-1" />
        </div>

        <div class="flex items-center gap-3">
          <Input v-model="editForm.displayName" placeholder="显示名称" class="flex-1" />
          <div class="w-32 shrink-0">
            <ColorPicker
              v-model="editForm.color"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <label class="cursor-pointer">
            <Button variant="outline" as-child>
              <span>选择图标</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="onIconFileChange"
            />
          </label>
          <Button variant="ghost" :disabled="!editForm.iconDataUrl" @click="editForm.iconDataUrl = ''">
            清除图标
          </Button>
          <img
            v-if="editForm.iconDataUrl"
            class="hotkey-icon-preview"
            :src="editForm.iconDataUrl"
            alt=""
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" @click="showEdit = false">
            取消
          </Button>
          <Button variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10" @click="clearCustomization">
            重置
          </Button>
          <Button @click="saveEdit">
            保存
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.hotkey-icon-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border);
}
</style>
