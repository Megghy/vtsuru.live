<script setup lang="ts">
import { NButton, NCard, NColorPicker, NDivider, NEmpty, NFlex, NGi, NGrid, NInput, NModal, NPopover, NSelect, NSwitch, NText, useMessage } from 'naive-ui';
import { computed, reactive, ref } from 'vue'
import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

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

const query = ref('')
const onlyFavorites = ref(props.defaultOnlyFavorites ?? false)
const onlyPinned = ref(false)
const groupMode = ref<'flat' | 'type' | 'custom'>('flat')
const safeClick = ref(props.defaultSafeClick ?? false)
const armedHotkeyID = ref<string | null>(null)
let armedTimer: number | null = null

const editing = ref<VtsHotkeyInfo | null>(null)
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

function getCustom(hotkeyID: string) {
  return vts.hotkeyCustomizations.find(h => h.hotkeyID === hotkeyID)
}

function openEdit(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  editing.value = hk
  editForm.hotkeyID = hk.hotkeyID
  editForm.favorite = c?.favorite ?? false
  editForm.pinned = c?.pinned ?? false
  editForm.group = c?.group ?? ''
  editForm.color = c?.color ?? ''
  editForm.displayName = c?.displayName ?? ''
  editForm.iconDataUrl = c?.iconDataUrl ?? ''
  showEdit.value = true
}

async function saveEdit() {
  await vts.setHotkeyCustomization({
    hotkeyID: editForm.hotkeyID,
    favorite: editForm.favorite,
    pinned: editForm.pinned || undefined,
    group: editForm.group?.trim() || undefined,
    color: editForm.color || undefined,
    displayName: editForm.displayName || undefined,
    iconDataUrl: editForm.iconDataUrl || undefined,
  })
  message.success('已保存 hotkey 设置')
  showEdit.value = false
}

async function clearCustomization() {
  await vts.removeHotkeyCustomization(editForm.hotkeyID)
  message.success('已清除 hotkey 自定义')
  showEdit.value = false
}

async function onIconFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 200 * 1024) {
    message.error('图标过大（>200KB），请换更小的图片')
    return
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图标失败'))
    reader.readAsDataURL(file)
  })
  if (!dataUrl.startsWith('data:image/')) {
    message.error('仅支持图片文件')
    return
  }
  editForm.iconDataUrl = dataUrl
}

async function toggleFavorite(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  await vts.setHotkeyCustomization({
    hotkeyID: hk.hotkeyID,
    favorite: !(c?.favorite ?? false),
    pinned: c?.pinned,
    group: c?.group,
    color: c?.color,
    iconDataUrl: c?.iconDataUrl,
    displayName: c?.displayName,
  })
}

async function togglePinned(hk: VtsHotkeyInfo) {
  const c = getCustom(hk.hotkeyID)
  await vts.setHotkeyCustomization({
    hotkeyID: hk.hotkeyID,
    favorite: c?.favorite ?? false,
    pinned: !(c?.pinned ?? false),
    group: c?.group,
    color: c?.color,
    iconDataUrl: c?.iconDataUrl,
    displayName: c?.displayName,
  })
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
  armedTimer = window.setTimeout(() => {
    disarm()
  }, 1500)
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = props.hotkeys.filter((h) => {
    if (!q) return true
    return h.name?.toLowerCase().includes(q)
      || h.description?.toLowerCase().includes(q)
      || h.type?.toLowerCase().includes(q)
  })
  const list2 = onlyFavorites.value
    ? list.filter(h => getCustom(h.hotkeyID)?.favorite)
    : list
  const list3 = onlyPinned.value
    ? list2.filter(h => getCustom(h.hotkeyID)?.pinned)
    : list2
  return list3.slice().sort((a, b) => {
    const ap = getCustom(a.hotkeyID)?.pinned ? 1 : 0
    const bp = getCustom(b.hotkeyID)?.pinned ? 1 : 0
    if (bp !== ap) return bp - ap
    const af = getCustom(a.hotkeyID)?.favorite ? 1 : 0
    const bf = getCustom(b.hotkeyID)?.favorite ? 1 : 0
    if (bf !== af) return bf - af
    return (a.name || a.hotkeyID).localeCompare(b.name || b.hotkeyID)
  })
})

const gridCols = computed(() => props.gridCols ?? 6)
const showSearch = computed(() => props.showSearch ?? true)
const showModelName = computed(() => props.showModelName ?? true)
const showSafeClick = computed(() => showSearch.value)

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
      ? (hk.type || 'Unknown')
      : (getCustom(hk.hotkeyID)?.group?.trim() || '未分组')
    const list = map.get(key) ?? []
    list.push(hk)
    map.set(key, list)
  }
  const entries = Array.from(map.entries())
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  return entries
})
</script>

<template>
  <component :is="props.embedded ? 'div' : NCard" v-bind="props.embedded ? {} : { size: 'small', title: '表情与动作（Hotkeys）' }">
    <NFlex vertical :size="12">
      <NFlex v-if="showSearch || (showModelName && modelName)" justify="space-between" align="center" :wrap="true" :size="8">
        <NFlex v-if="showSearch" align="center" :wrap="true" :size="8">
          <NInput v-model:value="query" placeholder="搜索 hotkey（名称/描述/类型）" style="min-width: 280px" />
          <NSwitch v-model:value="onlyFavorites" size="small">
            <template #checked>
              仅收藏
            </template>
            <template #unchecked>
              仅收藏
            </template>
          </NSwitch>
          <NSwitch v-model:value="onlyPinned" size="small">
            <template #checked>
              仅置顶
            </template>
            <template #unchecked>
              仅置顶
            </template>
          </NSwitch>
          <NSwitch v-if="showSafeClick" v-model:value="safeClick" size="small" @update:value="disarm">
            <template #checked>
              防误触
            </template>
            <template #unchecked>
              防误触
            </template>
          </NSwitch>
          <NSelect
            v-model:value="groupMode"
            size="small"
            style="width: 140px"
            :options="groupModeOptions as any"
          />
          <NButton size="small" @click="emit('refresh')">
            刷新
          </NButton>
        </NFlex>
        <NText v-if="showModelName && modelName" depth="3">
          当前模型：{{ modelName }}
        </NText>
      </NFlex>

      <NEmpty v-if="filtered.length === 0" description="暂无 hotkey" />

      <template v-else>
        <template v-if="groupMode === 'flat'">
          <NGrid x-gap="8" y-gap="8" :cols="gridCols">
            <NGi v-for="hk in filtered" :key="hk.hotkeyID">
              <NPopover trigger="hover">
                <template #trigger>
	                  <NButton
	                    block
	                    size="small"
	                    :disabled="disabled"
	                    :type="safeClick && armedHotkeyID === hk.hotkeyID ? 'warning' : 'default'"
	                    @click="handleTrigger(hk.hotkeyID)"
	                  >
                    <span
                      v-if="getCustom(hk.hotkeyID)?.color"
                      class="hotkey-color-dot"
                      :style="{ backgroundColor: getCustom(hk.hotkeyID)?.color }"
                    />
                    <img
                      v-if="getCustom(hk.hotkeyID)?.iconDataUrl"
                      class="hotkey-icon"
                      :src="getCustom(hk.hotkeyID)?.iconDataUrl"
                      alt=""
                    >
                    <span>
                      {{ getCustom(hk.hotkeyID)?.displayName || hk.name || hk.hotkeyID }}
                    </span>
                  </NButton>
                </template>
                <NFlex vertical :size="8" style="max-width: 320px">
                  <div>
                    <div>
                      {{ hk.name }}
                    </div>
                    <div v-if="hk.description">
                      {{ hk.description }}
                    </div>
                    <div v-if="hk.type">
                      type: {{ hk.type }}
                    </div>
                  </div>
                  <NFlex :wrap="true" :size="8">
                    <NButton size="tiny" @click="openEdit(hk)">
                      编辑
                    </NButton>
                    <NButton size="tiny" @click="togglePinned(hk)">
                      {{ (getCustom(hk.hotkeyID)?.pinned ?? false) ? '取消置顶' : '置顶' }}
                    </NButton>
                    <NButton size="tiny" @click="toggleFavorite(hk)">
                      {{ (getCustom(hk.hotkeyID)?.favorite ?? false) ? '取消收藏' : '收藏' }}
                    </NButton>
                  </NFlex>
                </NFlex>
              </NPopover>
            </NGi>
          </NGrid>
        </template>

        <template v-else>
          <div v-for="[key, list] in grouped" :key="key">
            <NFlex align="center" justify="space-between" :wrap="true" :size="8">
              <NText strong>
                {{ key }}
              </NText>
              <NText depth="3">
                {{ list.length }}
              </NText>
            </NFlex>
            <NDivider style="margin: 6px 0" />
            <NGrid x-gap="8" y-gap="8" :cols="gridCols">
              <NGi v-for="hk in list" :key="hk.hotkeyID">
                <NPopover trigger="hover">
                  <template #trigger>
	                    <NButton
	                      block
	                      size="small"
	                      :disabled="disabled"
	                      :type="safeClick && armedHotkeyID === hk.hotkeyID ? 'warning' : 'default'"
	                      @click="handleTrigger(hk.hotkeyID)"
	                    >
                      <span
                        v-if="getCustom(hk.hotkeyID)?.color"
                        class="hotkey-color-dot"
                        :style="{ backgroundColor: getCustom(hk.hotkeyID)?.color }"
                      />
                      <img
                        v-if="getCustom(hk.hotkeyID)?.iconDataUrl"
                        class="hotkey-icon"
                        :src="getCustom(hk.hotkeyID)?.iconDataUrl"
                        alt=""
                      >
                      <span>
                        {{ getCustom(hk.hotkeyID)?.displayName || hk.name || hk.hotkeyID }}
                      </span>
                    </NButton>
                  </template>
                  <NFlex vertical :size="8" style="max-width: 320px">
                    <div>
                      <div>
                        {{ hk.name }}
                      </div>
                      <div v-if="hk.description">
                        {{ hk.description }}
                      </div>
                      <div v-if="hk.type">
                        type: {{ hk.type }}
                      </div>
                    </div>
                    <NFlex :wrap="true" :size="8">
                      <NButton size="tiny" @click="openEdit(hk)">
                        编辑
                      </NButton>
                      <NButton size="tiny" @click="togglePinned(hk)">
                        {{ (getCustom(hk.hotkeyID)?.pinned ?? false) ? '取消置顶' : '置顶' }}
                      </NButton>
                      <NButton size="tiny" @click="toggleFavorite(hk)">
                        {{ (getCustom(hk.hotkeyID)?.favorite ?? false) ? '取消收藏' : '收藏' }}
                      </NButton>
                    </NFlex>
                  </NFlex>
                </NPopover>
              </NGi>
            </NGrid>
          </div>
        </template>
      </template>
    </NFlex>
  </component>

  <NModal v-model:show="showEdit" preset="card" title="Hotkey 设置" style="width: 640px">
    <NCard size="small" :bordered="false">
        <NFlex vertical :size="10">
          <NText depth="3">
            hotkeyID: {{ editForm.hotkeyID }}
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
          <NInput v-model:value="editForm.group" placeholder="分组（可选）" style="width: 160px" />
          <NInput v-model:value="editForm.displayName" placeholder="显示名称（可选）" style="width: 240px" />
          <NColorPicker v-model:value="editForm.color" :modes="['hex']" :show-alpha="false" style="width: 200px" />
        </NFlex>

        <NFlex align="center" :wrap="true" :size="10">
          <NButton size="small" tag="label">
            选择图标（图片）
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
            清除自定义
          </NButton>
          <NButton type="primary" @click="saveEdit">
            保存
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
  </NModal>
</template>

<style scoped>
.hotkey-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 6px;
  flex: 0 0 auto;
}

.hotkey-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  margin-right: 6px;
  object-fit: cover;
  flex: 0 0 auto;
}

.hotkey-icon-preview {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
