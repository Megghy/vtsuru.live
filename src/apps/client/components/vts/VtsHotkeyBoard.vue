<script setup lang="ts">
import { NButton, NCard, NColorPicker, NDivider, NEmpty, NFlex, NGi, NGrid, NInput, NModal, NSelect, NSwitch, NText } from 'naive-ui'
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

const customMap = computed(() =>
  new Map(vts.hotkeyCustomizations.map(h => [h.hotkeyID, h])),
)

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
  run(() => vts.setHotkeyCustomization({
    hotkeyID: editForm.hotkeyID,
    favorite: editForm.favorite,
    pinned: editForm.pinned || undefined,
    group: editForm.group?.trim() || undefined,
    color: editForm.color || undefined,
    displayName: editForm.displayName || undefined,
    iconDataUrl: editForm.iconDataUrl || undefined,
  }), '已保存')
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
  run(() => vts.setHotkeyCustomization({
    hotkeyID: hk.hotkeyID,
    favorite: !(c?.favorite ?? false),
    pinned: c?.pinned,
    group: c?.group,
    color: c?.color,
    iconDataUrl: c?.iconDataUrl,
    displayName: c?.displayName,
  }))
}

function togglePinned(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  run(() => vts.setHotkeyCustomization({
    hotkeyID: hk.hotkeyID,
    favorite: c?.favorite ?? false,
    pinned: !(c?.pinned ?? false),
    group: c?.group,
    color: c?.color,
    iconDataUrl: c?.iconDataUrl,
    displayName: c?.displayName,
  }))
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
    list = list.filter(h =>
      h.name?.toLowerCase().includes(q)
      || h.description?.toLowerCase().includes(q)
      || h.type?.toLowerCase().includes(q),
    )
  }
  if (onlyFavorites.value) list = list.filter(h => getCustom(h.hotkeyID)?.favorite)
  if (onlyPinned.value) list = list.filter(h => getCustom(h.hotkeyID)?.pinned)
  return list.slice().sort((a, b) => {
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
    const key = groupMode.value === 'type'
      ? (hk.type || '未知')
      : (getCustom(hk.hotkeyID)?.group?.trim() || '未分组')
    const arr = map.get(key) ?? []
    arr.push(hk)
    map.set(key, arr)
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
})
</script>

<template>
  <component :is="props.embedded ? 'div' : NCard" v-bind="props.embedded ? {} : { size: 'small', title: '表情与动作' }">
    <NFlex vertical :size="12">
      <NFlex v-if="isSearchVisible || (isModelNameVisible && modelName)" justify="space-between" align="center" :wrap="true" :size="8">
        <NFlex v-if="isSearchVisible" align="center" :wrap="true" :size="8">
          <NInput v-model:value="query" placeholder="搜索名称 / 描述 / 类型" style="min-width: 260px" />
          <NSwitch v-model:value="onlyFavorites" size="small">
            <template #checked>
              收藏
            </template>
            <template #unchecked>
              收藏
            </template>
          </NSwitch>
          <NSwitch v-model:value="onlyPinned" size="small">
            <template #checked>
              置顶
            </template>
            <template #unchecked>
              置顶
            </template>
          </NSwitch>
          <NSwitch v-model:value="safeClick" size="small" @update:value="disarm">
            <template #checked>
              防误触
            </template>
            <template #unchecked>
              防误触
            </template>
          </NSwitch>
          <NSelect v-model:value="groupMode" size="small" style="width: 130px" :options="groupModeOptions as any" />
          <NSwitch v-if="!props.embedded" v-model:value="deckMode" size="small">
            <template #checked>
              大图标
            </template>
            <template #unchecked>
              大图标
            </template>
          </NSwitch>
          <NButton size="small" @click="emit('refresh')">
            刷新
          </NButton>
        </NFlex>
        <NText v-if="isModelNameVisible && modelName" depth="3">
          当前模型: {{ modelName }}
        </NText>
      </NFlex>

      <NEmpty v-if="filtered.length === 0" description="暂无可用表情/动作" />

      <template v-else-if="groupMode === 'flat'">
        <NGrid x-gap="8" y-gap="8" :cols="deckMode ? Math.min(cols, 4) : cols">
          <NGi v-for="hk in filtered" :key="hk.hotkeyID">
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
          </NGi>
        </NGrid>
      </template>

      <template v-else>
        <div v-for="[key, list] in grouped" :key="key">
          <NFlex align="center" justify="space-between" :size="8">
            <NText strong>
              {{ key }}
            </NText>
            <NText depth="3">
              {{ list.length }}
            </NText>
          </NFlex>
          <NDivider style="margin: 6px 0" />
          <NGrid x-gap="8" y-gap="8" :cols="deckMode ? Math.min(cols, 4) : cols">
            <NGi v-for="hk in list" :key="hk.hotkeyID">
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
            </NGi>
          </NGrid>
        </div>
      </template>
    </NFlex>
  </component>

  <NModal v-model:show="showEdit" preset="card" title="自定义 Hotkey" style="width: 600px">
    <NFlex vertical :size="12">
      <NText depth="3">
        ID: {{ editForm.hotkeyID }}
      </NText>

      <NFlex align="center" :wrap="true" :size="10">
        <NSwitch v-model:value="editForm.favorite" size="small">
          <template #checked>
            收藏
          </template>
          <template #unchecked>
            收藏
          </template>
        </NSwitch>
        <NSwitch v-model:value="editForm.pinned" size="small">
          <template #checked>
            置顶
          </template>
          <template #unchecked>
            置顶
          </template>
        </NSwitch>
        <NInput v-model:value="editForm.group" placeholder="分组" style="width: 140px" />
        <NInput v-model:value="editForm.displayName" placeholder="显示名称" style="width: 200px" />
        <NColorPicker v-model:value="editForm.color" :modes="['hex']" :show-alpha="false" style="width: 180px" />
      </NFlex>

      <NFlex align="center" :wrap="true" :size="10">
        <NButton size="small" tag="label">
          选择图标
          <input type="file" accept="image/*" style="display:none" @change="onIconFileChange">
        </NButton>
        <NButton size="small" :disabled="!editForm.iconDataUrl" @click="editForm.iconDataUrl = ''">
          清除图标
        </NButton>
        <img v-if="editForm.iconDataUrl" class="hotkey-icon-preview" :src="editForm.iconDataUrl" alt="">
      </NFlex>

      <NFlex justify="end" :size="8">
        <NButton @click="showEdit = false">
          取消
        </NButton>
        <NButton type="error" @click="clearCustomization">
          重置
        </NButton>
        <NButton type="primary" @click="saveEdit">
          保存
        </NButton>
      </NFlex>
    </NFlex>
  </NModal>
</template>

<style scoped>
.hotkey-icon-preview {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
