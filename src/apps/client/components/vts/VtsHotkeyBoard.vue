<script setup lang="ts">
import { RefreshCw, Search } from 'lucide-vue-next'
import { computed, onUnmounted, reactive, ref } from 'vue'

import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import { useFilePicker } from '@/composables/useFilePicker'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
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
const refreshing = ref(false)
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
      displayName: editForm.displayName.trim() || undefined,
      iconDataUrl: editForm.iconDataUrl || undefined,
    },
    '已保存',
  )
  showEdit.value = false
}

function clearCustomization() {
  void run(() => vts.removeHotkeyCustomization(editForm.hotkeyID), '已重置自定义外观')
  showEdit.value = false
}

const { open: openIconPicker } = useFilePicker({
  accept: 'image/*',
  maxSize: ICON_MAX_BYTES,
  onSelect: ([file]) => {
    void run(async () => {
      editForm.iconDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('读取图标失败'))
        reader.readAsDataURL(file)
      })
    })
  },
})

function togglePinned(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  void saveCustom({ ...c, hotkeyID: hk.hotkeyID, pinned: !c?.pinned || undefined })
}

function addToDeck(hk: VtsHotkeyInfo) {
  const custom = getCustom(hk.hotkeyID)
  const label = custom?.displayName || hk.name || hk.hotkeyID
  void run(
    () =>
      vts.upsertDeckTile({
        ...newDeckTile('hotkey', hk.hotkeyID, label, custom?.group),
        color: custom?.color,
      }),
    '已加入操作台',
  )
}

function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  emit('refresh')
  window.setTimeout(() => {
    refreshing.value = false
  }, 400)
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
    ? props.hotkeys.filter((h) => {
        const c = getCustom(h.hotkeyID)
        return [h.name, h.description, h.type, h.hotkeyID, c?.displayName, c?.group].some((s) =>
          s?.toLowerCase().includes(q),
        )
      })
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
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <CardTitle>表情与动作热键</CardTitle>
        <Badge
          v-if="hotkeys.length > 0"
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ hotkeys.length }}
        </Badge>
      </div>
      <div
        v-if="modelName"
        class="text-xs text-muted-foreground"
      >
        当前模型: {{ modelName }}
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative min-w-[200px] flex-1">
          <Search
            class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            v-model="query"
            placeholder="搜索名称 / 自定义别名 / 分组 / 类型"
            class="pl-8"
          />
        </div>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Switch
            :checked="safeClick"
            @update:checked="((safeClick = $event), disarm())"
          />
          <span class="text-xs text-muted-foreground">防误触</span>
        </label>
        <div class="w-28">
          <Select v-model="groupMode">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in groupModeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="secondary"
          class="gap-1.5"
          :disabled="disabled || refreshing"
          @click="handleRefresh"
        >
          <RefreshCw
            class="size-3.5"
            :class="refreshing ? 'animate-spin' : ''"
          />
          刷新
        </Button>
      </div>

      <div
        v-if="safeClick"
        class="text-[11px] text-muted-foreground"
      >
        防误触已开启：同一按钮需连续点击两次才会触发
      </div>

      <div
        v-if="filtered.length === 0"
        class="py-6 flex-col-center"
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
          <div class="flex-between pt-1">
            <span class="text-xs font-semibold text-foreground">{{ key }}</span>
            <span class="text-[11px] text-muted-foreground tabular-nums">{{ list.length }}</span>
          </div>
          <Separator class="my-1" />
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          <div
            v-for="hk in list"
            :key="hk.hotkeyID"
            class="min-w-0"
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
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base">自定义热键外观</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <div class="text-[11px] text-muted-foreground font-mono">ID: {{ editForm.hotkeyID }}</div>

        <SettingRow
          type="switch"
          variant="compact"
          title="置顶显示"
          v-model="editForm.pinned"
        />

        <div class="grid grid-cols-2 gap-2.5">
          <FormField
            label="显示别名"
            class="min-w-0"
          >
            <Input
              v-model="editForm.displayName"
              placeholder="覆盖原热键名"
            />
          </FormField>
          <FormField
            label="自定义分组"
            class="min-w-0"
          >
            <Input
              v-model="editForm.group"
              placeholder="如 表情 / 动作"
            />
          </FormField>
        </div>

        <FormField label="色标颜色">
          <div class="flex items-center gap-2">
            <ColorPicker v-model="editForm.color" />
            <Button
              v-if="editForm.color"
              variant="ghost"
              class="px-2"
              @click="editForm.color = ''"
            >
              清除
            </Button>
          </div>
        </FormField>

        <FormField
          label="自定义图标"
          description="支持最大 200KB 的图片"
        >
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              @click="openIconPicker()"
            >
              选择图标
            </Button>
            <Button
              variant="ghost"
              :disabled="!editForm.iconDataUrl"
              @click="editForm.iconDataUrl = ''"
            >
              清除图标
            </Button>
            <img
              v-if="editForm.iconDataUrl"
              class="size-7 rounded object-cover border border-border"
              :src="editForm.iconDataUrl"
              alt=""
            />
          </div>
        </FormField>
      </div>

      <DialogFooter class="flex items-center justify-end gap-2 pt-2">
        <Popconfirm
          title="确认重置此热键的自定义外观？"
          @confirm="clearCustomization"
        >
          <Button
            variant="outline"
            class="border-destructive/40 text-destructive hover:bg-destructive/10 mr-auto"
          >
            重置外观
          </Button>
        </Popconfirm>
        <Button
          variant="outline"
          @click="showEdit = false"
        >
          取消
        </Button>
        <Button @click="saveEdit">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
