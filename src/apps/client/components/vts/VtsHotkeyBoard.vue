<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'

import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'
import VtsHotkeyButton from './VtsHotkeyButton.vue'

const props = defineProps<{
  hotkeys: VtsHotkeyInfo[]
  disabled?: boolean
  modelName?: string | null
  gridCols?: number
  embedded?: boolean
  showSearch?: boolean
  defaultOnlyFavorites?: boolean
  defaultSafeClick?: boolean
  showModelName?: boolean
}>()

const emit = defineEmits<{
  (e: 'trigger', hotkeyID: string): void
  (e: 'refresh'): void
}>()

const vts = useVtsStore()
const { run } = useVtsAction()

const query = ref('')
const onlyFavorites = ref(props.defaultOnlyFavorites ?? false)
const onlyPinned = ref(false)
const groupMode = ref<'flat' | 'type' | 'custom'>('flat')
const safeClick = ref(props.defaultSafeClick ?? false)
const armedHotkeyID = ref<string | null>(null)
const deckMode = ref(false)
let armedTimer: number | null = null

const showEdit = ref(false)
const editForm = reactive({
  hotkeyID: '',
  favorite: false,
  pinned: false,
  group: '',
  color: '',
  displayName: '',
  iconDataUrl: '',
})

const customMap = computed(() => new Map(vts.hotkeyCustomizations.map((h) => [h.hotkeyID, h])))

function getCustom(hotkeyID: string) {
  return customMap.value.get(hotkeyID)
}

function openEdit(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  editForm.hotkeyID = hk.hotkeyID
  editForm.favorite = c?.favorite ?? false
  editForm.pinned = c?.pinned ?? false
  editForm.group = c?.group ?? ''
  editForm.color = c?.color ?? ''
  editForm.displayName = c?.displayName ?? ''
  editForm.iconDataUrl = c?.iconDataUrl ?? ''
  showEdit.value = true
}

function saveEdit() {
  run(
    () =>
      vts.setHotkeyCustomization({
        hotkeyID: editForm.hotkeyID,
        favorite: editForm.favorite,
        pinned: editForm.pinned || undefined,
        group: editForm.group?.trim() || undefined,
        color: editForm.color || undefined,
        displayName: editForm.displayName || undefined,
        iconDataUrl: editForm.iconDataUrl || undefined,
      }),
    '已保存',
  )
  showEdit.value = false
}

function clearCustomization() {
  run(() => vts.removeHotkeyCustomization(editForm.hotkeyID), '已清除自定义')
  showEdit.value = false
}

async function onIconFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 200 * 1024) {
    run(() => Promise.reject(new Error('图标过大（>200KB），请换更小的图片')))
    return
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图标失败'))
    reader.readAsDataURL(file)
  })
  if (!dataUrl.startsWith('data:image/')) {
    run(() => Promise.reject(new Error('仅支持图片文件')))
    return
  }
  editForm.iconDataUrl = dataUrl
}

function toggleFavorite(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  run(() =>
    vts.setHotkeyCustomization({
      hotkeyID: hk.hotkeyID,
      favorite: !(c?.favorite ?? false),
      pinned: c?.pinned,
      group: c?.group,
      color: c?.color,
      iconDataUrl: c?.iconDataUrl,
      displayName: c?.displayName,
    }),
  )
}

function togglePinned(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  run(() =>
    vts.setHotkeyCustomization({
      hotkeyID: hk.hotkeyID,
      favorite: c?.favorite ?? false,
      pinned: !(c?.pinned ?? false),
      group: c?.group,
      color: c?.color,
      iconDataUrl: c?.iconDataUrl,
      displayName: c?.displayName,
    }),
  )
}

function disarm() {
  armedHotkeyID.value = null
  if (armedTimer != null) {
    clearTimeout(armedTimer)
    armedTimer = null
  }
}

function handleTrigger(hotkeyID: string) {
  if (!safeClick.value || props.disabled) {
    emit('trigger', hotkeyID)
    return
  }
  if (armedHotkeyID.value === hotkeyID) {
    disarm()
    emit('trigger', hotkeyID)
    return
  }
  armedHotkeyID.value = hotkeyID
  if (armedTimer != null) clearTimeout(armedTimer)
  armedTimer = window.setTimeout(disarm, 1500)
}

onUnmounted(() => {
  if (armedTimer != null) {
    clearTimeout(armedTimer)
    armedTimer = null
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = props.hotkeys
  if (q) {
    list = list.filter(
      (h) =>
        h.name?.toLowerCase().includes(q) ||
        h.description?.toLowerCase().includes(q) ||
        h.type?.toLowerCase().includes(q),
    )
  }
  if (onlyFavorites.value) list = list.filter((h) => getCustom(h.hotkeyID)?.favorite)
  if (onlyPinned.value) list = list.filter((h) => getCustom(h.hotkeyID)?.pinned)
  return list.slice().toSorted((a, b) => {
    const ap = getCustom(a.hotkeyID)?.pinned ? 1 : 0
    const bp = getCustom(b.hotkeyID)?.pinned ? 1 : 0
    if (bp !== ap) return bp - ap
    const af = getCustom(a.hotkeyID)?.favorite ? 1 : 0
    const bf = getCustom(b.hotkeyID)?.favorite ? 1 : 0
    if (bf !== af) return bf - af
    return (a.name || a.hotkeyID).localeCompare(b.name || b.hotkeyID)
  })
})

const cols = computed(() => props.gridCols ?? 6)
const isSearchVisible = computed(() => props.showSearch ?? true)
const isModelNameVisible = computed(() => props.showModelName ?? true)

const groupModeOptions = [
  { label: '平铺', value: 'flat' },
  { label: '按类型', value: 'type' },
  { label: '按自定义组', value: 'custom' },
] as const

const grouped = computed(() => {
  if (groupMode.value === 'flat') return []
  const map = new Map<string, VtsHotkeyInfo[]>()
  for (const hk of filtered.value) {
    const key = groupMode.value === 'type' ? hk.type || '未知' : getCustom(hk.hotkeyID)?.group?.trim() || '未分组'
    const arr = map.get(key) ?? []
    arr.push(hk)
    map.set(key, arr)
  }
  return Array.from(map.entries()).toSorted((a, b) => a[0].localeCompare(b[0]))
})
</script>

<template>
  <component
    :is="props.embedded ? 'div' : 'UCard'"
    v-bind="props.embedded ? {} : { size: 'small', bordered: true, title: '表情与动作' }"
  >
    <div
      vertical
      :size="12"
    >
      <div
        v-if="isSearchVisible || (isModelNameVisible && modelName)"
        justify="space-between"
        align="center"
        :wrap="true"
        :size="8"
      >
        <div
          v-if="isSearchVisible"
          align="center"
          :wrap="true"
          :size="8"
        >
          <UInput
            v-model="query"
            placeholder="搜索名称 / 描述 / 类型"
            style="min-width: 260px"
          />
          <USwitch
            v-model="onlyFavorites"
            size="small"
          >
            <template v-if="false"> 收藏 </template>
            <template v-if="false"> 收藏 </template>
          </USwitch>
          <USwitch
            v-model="onlyPinned"
            size="small"
          >
            <template v-if="false"> 置顶 </template>
            <template v-if="false"> 置顶 </template>
          </USwitch>
          <USwitch
            v-model="safeClick"
            size="small"
            @update:model-value="disarm"
          >
            <template v-if="false"> 防误触 </template>
            <template v-if="false"> 防误触 </template>
          </USwitch>
          <USelectMenu
            v-model="groupMode"
            size="small"
            style="width: 130px"
            :items="groupModeOptions as any"
            value-key="value"
          />
          <USwitch
            v-if="!props.embedded"
            v-model="deckMode"
            size="small"
          >
            <template v-if="false"> 大图标 </template>
            <template v-if="false"> 大图标 </template>
          </USwitch>
          <UButton
            size="small"
            @click="emit('refresh')"
          >
            刷新
          </UButton>
        </div>
        <span
          v-if="isModelNameVisible && modelName"
          depth="3"
        >
          当前模型: {{ modelName }}
        </span>
      </div>

      <UEmpty
        v-if="filtered.length === 0"
        description="暂无可用表情/动作"
      />

      <template v-else-if="groupMode === 'flat'">
        <div
          x-gap="8"
          y-gap="8"
          :cols="deckMode ? Math.min(cols, 4) : cols"
        >
          <div
            v-for="hk in filtered"
            :key="hk.hotkeyID"
          >
            <VtsHotkeyButton
              :hk="hk"
              :custom="getCustom(hk.hotkeyID)"
              :disabled="disabled"
              :armed="armedHotkeyID === hk.hotkeyID"
              :safe-click="safeClick"
              :deck="deckMode"
              @trigger="handleTrigger(hk.hotkeyID)"
              @edit="openEdit(hk)"
              @toggle-pinned="togglePinned(hk)"
              @toggle-favorite="toggleFavorite(hk)"
            />
          </div>
        </div>
      </template>

      <template v-else>
        <div
          v-for="[key, list] in grouped"
          :key="key"
        >
          <div
            align="center"
            justify="space-between"
            :size="8"
          >
            <span strong>
              {{ key }}
            </span>
            <span depth="3">
              {{ list.length }}
            </span>
          </div>
          <USeparator style="margin: 6px 0" />
          <div
            x-gap="8"
            y-gap="8"
            :cols="deckMode ? Math.min(cols, 4) : cols"
          >
            <div
              v-for="hk in list"
              :key="hk.hotkeyID"
            >
              <VtsHotkeyButton
                :hk="hk"
                :custom="getCustom(hk.hotkeyID)"
                :disabled="disabled"
                :armed="armedHotkeyID === hk.hotkeyID"
                :safe-click="safeClick"
                :deck="deckMode"
                @trigger="handleTrigger(hk.hotkeyID)"
                @edit="openEdit(hk)"
                @toggle-pinned="togglePinned(hk)"
                @toggle-favorite="toggleFavorite(hk)"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </component>

  <UModal
    v-model:open="showEdit"
    preset="card"
    title="自定义 Hotkey"
    style="width: 600px"
  >
    <div
      vertical
      :size="12"
    >
      <span depth="3"> ID: {{ editForm.hotkeyID }} </span>

      <div
        align="center"
        :wrap="true"
        :size="12"
      >
        <USwitch
          v-model="editForm.favorite"
          size="small"
        >
          <template v-if="false"> 收藏 </template>
          <template v-if="false"> 收藏 </template>
        </USwitch>
        <USwitch
          v-model="editForm.pinned"
          size="small"
        >
          <template v-if="false"> 置顶 </template>
          <template v-if="false"> 置顶 </template>
        </USwitch>
        <UInput
          v-model="editForm.group"
          placeholder="分组"
          style="width: 140px"
        />
        <UInput
          v-model="editForm.displayName"
          placeholder="显示名称"
          style="width: 200px"
        />
        <UColorPicker
          v-model="editForm.color"
          :modes="['hex']"
          :show-alpha="false"
          style="width: 180px"
        />
      </div>

      <div
        align="center"
        :wrap="true"
        :size="12"
      >
        <UButton
          size="small"
          tag="label"
        >
          选择图标
          <input
            type="file"
            accept="image/*"
            style="display: none"
            @change="onIconFileChange"
          />
        </UButton>
        <UButton
          size="small"
          :disabled="!editForm.iconDataUrl"
          @click="editForm.iconDataUrl = ''"
        >
          清除图标
        </UButton>
        <img
          v-if="editForm.iconDataUrl"
          class="hotkey-icon-preview"
          :src="editForm.iconDataUrl"
          alt=""
        />
      </div>

      <div
        justify="end"
        :size="8"
      >
        <UButton @click="showEdit = false"> 取消 </UButton>
        <UButton
          color="error"
          @click="clearCustomization"
        >
          重置
        </UButton>
        <UButton
          color="primary"
          @click="saveEdit"
        >
          保存
        </UButton>
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.hotkey-icon-preview {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
