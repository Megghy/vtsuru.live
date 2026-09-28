<script setup lang="ts">
import {
  NButton,
  NCard,
  NColorPicker,
  NDivider,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NInput,
  NModal,
  NSelect,
  NSwitch,
  NText,
} from 'naive-ui'
import { computed, onUnmounted, reactive, ref } from 'vue'

import type { VtsHotkeyInfo } from '@/apps/client/api/vts/messages'
import { newDeckTile } from '@/apps/client/store/vts/deck'
import type { VtsHotkeyCustomization } from '@/apps/client/store/useVtsStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'

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
  <NCard
    size="small"
    bordered
    title="表情与动作热键"
  >
    <template #header-extra>
      <NText
        v-if="modelName"
        depth="3"
      >
        当前模型: {{ modelName }}
      </NText>
    </template>
    <NFlex
      vertical
      :size="12"
    >
      <NFlex
        align="center"
        :wrap="true"
        :size="8"
      >
        <NInput
          v-model:value="query"
          placeholder="搜索名称 / 描述 / 类型"
          clearable
          style="min-width: 240px; flex: 1"
        />
        <NSwitch
          v-model:value="safeClick"
          size="small"
          @update:value="disarm"
        >
          <template #checked> 防误触 </template>
          <template #unchecked> 防误触 </template>
        </NSwitch>
        <NSelect
          v-model:value="groupMode"
          size="small"
          style="width: 130px"
          :options="groupModeOptions"
        />
        <NButton
          size="small"
          :disabled="disabled"
          @click="emit('refresh')"
        >
          刷新
        </NButton>
      </NFlex>
      <NText
        v-if="safeClick"
        depth="3"
        style="font-size: 12px"
      >
        防误触已开启：同一按钮需连续点击两次才会触发
      </NText>

      <NEmpty
        v-if="filtered.length === 0"
        :description="disabled ? '连接 VTS 后显示当前模型的热键' : '当前模型没有匹配的热键'"
      />

      <div
        v-for="[key, list] in groups"
        v-else
        :key="key"
      >
        <template v-if="key">
          <NFlex
            align="center"
            justify="space-between"
          >
            <NText strong>{{ key }}</NText>
            <NText depth="3">{{ list.length }}</NText>
          </NFlex>
          <NDivider style="margin: 6px 0" />
        </template>
        <NGrid
          x-gap="8"
          y-gap="8"
          cols="2 600:4 900:6"
          responsive="self"
        >
          <NGi
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
          </NGi>
        </NGrid>
      </div>
    </NFlex>
  </NCard>

  <NModal
    v-model:show="showEdit"
    preset="card"
    title="自定义热键外观"
    style="width: 600px"
  >
    <NFlex
      vertical
      :size="12"
    >
      <NText depth="3"> ID: {{ editForm.hotkeyID }} </NText>

      <NFlex
        align="center"
        :wrap="true"
        :size="12"
      >
        <NSwitch
          v-model:value="editForm.pinned"
          size="small"
        >
          <template #checked> 置顶 </template>
          <template #unchecked> 置顶 </template>
        </NSwitch>
        <NInput
          v-model:value="editForm.group"
          placeholder="分组"
          style="width: 140px"
        />
        <NInput
          v-model:value="editForm.displayName"
          placeholder="显示名称"
          style="width: 200px"
        />
        <NColorPicker
          v-model:value="editForm.color"
          :modes="['hex']"
          :show-alpha="false"
          style="width: 180px"
        />
      </NFlex>

      <NFlex
        align="center"
        :wrap="true"
        :size="12"
      >
        <NButton
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
        </NButton>
        <NButton
          size="small"
          :disabled="!editForm.iconDataUrl"
          @click="editForm.iconDataUrl = ''"
        >
          清除图标
        </NButton>
        <img
          v-if="editForm.iconDataUrl"
          class="hotkey-icon-preview"
          :src="editForm.iconDataUrl"
          alt=""
        />
      </NFlex>

      <NFlex
        justify="end"
        :size="8"
      >
        <NButton @click="showEdit = false"> 取消 </NButton>
        <NButton
          type="error"
          @click="clearCustomization"
        >
          重置
        </NButton>
        <NButton
          type="primary"
          @click="saveEdit"
        >
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
