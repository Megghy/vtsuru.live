<script setup lang="ts">
import {
  ArrowDownload24Regular,
  ArrowSort24Regular,
  Box24Regular,
  Checkmark24Filled,
  Dismiss24Filled,
  DocumentArrowDown20Regular,
  Filter24Regular,
  Info12Filled,
  Money24Regular,
  Search24Filled,
  VehicleShip24Filled,
} from '@vicons/fluent'
import { saveAs } from 'file-saver'
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopover,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSkeleton,
  NSpin,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { AccountInfo, DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import DanmakuItem from '@/apps/manage/components/live/DanmakuItem.vue'
import { GetString } from '@/apps/manage/components/live/danmakuExport'
import SimpleVirtualList from '@/apps/manage/components/live/SimpleVirtualList.vue'

const props = withDefaults(
  defineProps<{
    currentLive: ResponseLiveInfoModel
    currentDanmakus?: DanmakuModel[]
    height?: number | string
    isInModal?: boolean
    showBorder?: boolean
    to?: 'userDanmakus' | 'space'
  }>(),
  {
    currentDanmakus: () => [],
    height: '620px',
    isInModal: false,
    showBorder: true,
    to: 'userDanmakus',
  },
)

const emit = defineEmits<{
  (e: 'onClickName', uId: number, ouId: string): void
}>()

const accountInfo = useAccount()
const message = useMessage()

// 数据源
const baseDanmakus = shallowRef<DanmakuModel[]>([])
const dynamicDanmakus = shallowRef<DanmakuModel[]>([])

// 筛选状态
const keyword = ref('')
const enableRegex = ref(false)
const deselect = ref(false)

const filterSelected = ref<EventDataTypes[]>([
  EventDataTypes.Message,
  EventDataTypes.Gift,
  EventDataTypes.Guard,
  EventDataTypes.SC,
  EventDataTypes.Enter,
])

const price = ref<number | undefined>(undefined)
const orderByPrice = ref(false)
const orderDecreasing = ref(false)
const hideEmoji = ref(false)
const hideAvatar = ref(false)

// 导出与弹窗
const showExportModal = ref(false)
const isExporting = ref(false)
const exportType = ref<'json' | 'xml' | 'csv'>('json')
const onlyExportFilteredDanmakus = ref(true)

const showModal = ref(false)
const userDanmakus = ref<DanmakuModel[] | undefined>(undefined)

function createDanmakuSignature(item: DanmakuModel): string {
  return `${item.id}_${item.time}_${item.type}_${item.uId}_${item.ouId ?? ''}`
}

function normalizeDanmakuList(list: DanmakuModel[], seen: Set<string>): DanmakuModel[] {
  const result: DanmakuModel[] = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item) continue
    const sig = createDanmakuSignature(item)
    if (seen.has(sig)) continue
    seen.add(sig)
    if (!item.id) {
      item.id = `${sig}_${i}`
    }
    result.push(item)
  }
  return result
}

watch(
  () => props.currentDanmakus,
  (val) => {
    const seen = new Set<string>()
    baseDanmakus.value = normalizeDanmakuList(val ?? [], seen)
    dynamicDanmakus.value = []
  },
  { immediate: true, deep: true },
)

const combinedDanmakus = computed(() => {
  if (!dynamicDanmakus.value.length) return baseDanmakus.value
  const seen = new Set<string>()
  const merged: DanmakuModel[] = []
  for (const item of baseDanmakus.value) {
    const sig = createDanmakuSignature(item)
    if (!seen.has(sig)) {
      seen.add(sig)
      merged.push(item)
    }
  }
  for (const item of dynamicDanmakus.value) {
    const sig = createDanmakuSignature(item)
    if (!seen.has(sig)) {
      seen.add(sig)
      merged.push(item)
    }
  }
  return merged
})

const filteredDanmakus = computed(() => {
  const source = combinedDanmakus.value
  if (!source.length) return []

  const selectedTypes = new Set(filterSelected.value)
  let working = source.filter((item) => selectedTypes.has(item.type))

  if (hideEmoji.value) {
    working = working.filter((item) => item.type !== EventDataTypes.Message || !item.isEmoji)
  }

  const keywordValue = keyword.value.trim()
  if (keywordValue !== '') {
    let regex: RegExp | null = null
    if (enableRegex.value) {
      try {
        regex = new RegExp(keywordValue)
      } catch {
        regex = null
      }
    }
    const keywordLower = keywordValue.toLowerCase()
    const matcher = (item: DanmakuModel) => {
      if (item.uId != null && item.uId.toString() === keywordValue) return true
      if (item.uName && item.uName === keywordValue) return true
      const danmakuText = item.msg ?? ''
      if (!danmakuText) return false
      if (regex) {
        return regex.test(danmakuText)
      }
      return danmakuText.toLowerCase().includes(keywordLower)
    }
    working = working.filter((item) => (deselect.value ? !matcher(item) : matcher(item)))
  }

  if (price.value && price.value > 0) {
    const minPrice = price.value
    working = working.filter((item) => (item.price ?? 0) >= (minPrice ?? 0))
  }

  if (orderByPrice.value) {
    working = working
      .filter((item) => item.type !== EventDataTypes.Message)
      .toSorted((a, b) => (a.price ?? 0) - (b.price ?? 0))
  } else {
    working = [...working].toSorted((a, b) => a.time - b.time)
  }

  if (orderDecreasing.value) {
    working.reverse()
  }

  return working
})

const filteredDanmakuCount = computed(() => filteredDanmakus.value.length)
const totalDanmakuCount = computed(() => combinedDanmakus.value.length)
const totalFilteredPrice = computed(() =>
  filteredDanmakus.value.reduce((sum, item) => sum + (item.price && item.price > 0 ? item.price : 0), 0),
)

function onNameClick(uId: number, ouId: string) {
  if (props.isInModal) {
    emit('onClickName', uId, ouId)
    return
  }
  const sourceDanmakus = combinedDanmakus.value
  switch (props.to) {
    case 'userDanmakus': {
      userDanmakus.value = sourceDanmakus.filter((d) => (d.uId ? d.uId === uId : d.ouId === ouId))
      showModal.value = true
      break
    }
    case 'space': {
      if (!uId) {
        message.error('从开放平台获取的弹幕已不再支持前往用户空间')
        return
      }
      showModal.value = false
      nextTick(() => {
        window.open(`https://space.bilibili.com/${uId}`, '_blank')
      })
      break
    }
  }
}

function handlePriceQuickSelect(p: number | undefined) {
  price.value = price.value === p ? undefined : p
}

function handleExport() {
  isExporting.value = true
  try {
    const source = onlyExportFilteredDanmakus.value ? filteredDanmakus.value : combinedDanmakus.value
    saveAs(
      new Blob([GetString(accountInfo.value, props.currentLive, source, exportType.value)], {
        type: 'text/plain;charset=utf-8',
      }),
      `${Date.now()}_${props.currentLive.startAt}_${props.currentLive.title.replace(/[\/\\]/g, '-')}_${accountInfo.value?.name ?? 'live'}.${exportType.value}`,
    )
    showExportModal.value = false
    message.success('弹幕导出成功')
  } catch (err) {
    message.error('导出失败')
  } finally {
    isExporting.value = false
  }
}

function insertDanmakus(targetDanmakus: DanmakuModel[]) {
  if (!Array.isArray(targetDanmakus) || targetDanmakus.length === 0) return
  const existingIds = new Set<string>([
    ...baseDanmakus.value.map((item) => item.id),
    ...dynamicDanmakus.value.map((item) => item.id),
  ])
  const normalized = normalizeDanmakuList(targetDanmakus, existingIds)
  if (!normalized.length) return
  dynamicDanmakus.value = orderDecreasing.value
    ? [...normalized, ...dynamicDanmakus.value]
    : [...dynamicDanmakus.value, ...normalized]
}

defineExpose({
  InsertDanmakus: insertDanmakus,
})
</script>

<template>
  <div class="danmaku-container-wrapper">
    <!-- 用户单人弹幕弹窗 -->
    <NModal
      v-model:show="showModal"
      preset="card"
      style="width: 680px; max-width: 92vw; max-height: 85vh"
      content-style="overflow-y: auto; padding: 12px 16px;"
      @after-leave="userDanmakus = undefined"
    >
      <template #header>
        <span class="user-modal-title">
          观众「{{ userDanmakus?.[0]?.uName || '未知用户' }}」在本场的发言 ({{ userDanmakus?.length || 0 }} 条)
        </span>
      </template>
      <DanmakuContainer
        :current-danmakus="userDanmakus ?? []"
        :current-live="props.currentLive"
        height="480px"
        :show-border="false"
        to="space"
      />
    </NModal>

    <!-- 弹幕导出弹窗 -->
    <NModal
      v-model:show="showExportModal"
      preset="card"
      style="width: 480px; max-width: 90vw"
      title="导出弹幕数据"
    >
      <NSpin :show="isExporting">
        <NFlex
          vertical
          :size="16"
        >
          <div>
            <div class="export-label">选择导出格式</div>
            <NRadioGroup
              v-model:value="exportType"
              name="export-format"
            >
              <NRadioButton value="json">JSON 完整格式</NRadioButton>
              <NRadioButton value="xml">XML (B站弹幕机标准)</NRadioButton>
              <NRadioButton value="csv">CSV (Excel 表格)</NRadioButton>
            </NRadioGroup>
          </div>

          <div>
            <NCheckbox v-model:checked="onlyExportFilteredDanmakus">
              仅导出当前筛选后的弹幕 (当前 {{ filteredDanmakuCount }} 条)
            </NCheckbox>
          </div>

          <NFlex justify="flex-end" :size="10">
            <NButton @click="showExportModal = false">取消</NButton>
            <NButton
              type="primary"
              :loading="isExporting"
              @click="handleExport"
            >
              立即导出
            </NButton>
          </NFlex>
        </NFlex>
      </NSpin>
    </NModal>

    <!-- 筛选控制工具条 (Bento Style) -->
    <NCard
      size="small"
      class="danmaku-toolbar-card"
      :bordered="props.showBorder"
    >
      <NFlex
        vertical
        :size="12"
      >
        <!-- 第一行：搜索与类型快速过滤 -->
        <NFlex
          justify="space-between"
          align="center"
          wrap
          :size="10"
        >
          <!-- 搜索输入 -->
          <NFlex
            align="center"
            wrap
            :size="8"
          >
            <NInput
              v-model:value="keyword"
              placeholder="搜索发言内容、用户名或 UID..."
              clearable
              size="small"
              class="danmaku-search-input"
            >
              <template #prefix>
                <NIcon :component="Search24Filled" />
              </template>
            </NInput>

            <NCheckbox v-model:checked="enableRegex" size="small">
              正则
            </NCheckbox>
            <NCheckbox v-model:checked="deselect" size="small">
              反选
            </NCheckbox>
          </NFlex>

          <!-- 右侧：导出与视图选项 -->
          <NFlex
            align="center"
            wrap
            :size="8"
          >
            <NCheckbox v-model:checked="hideEmoji" size="small">
              隐藏表情
            </NCheckbox>
            <NCheckbox v-model:checked="hideAvatar" size="small">
              隐藏头像
            </NCheckbox>

            <NDivider vertical />

            <NButton
              size="small"
              type="primary"
              secondary
              @click="showExportModal = true"
            >
              <template #icon>
                <NIcon :component="DocumentArrowDown20Regular" />
              </template>
              导出弹幕
            </NButton>
          </NFlex>
        </NFlex>

        <!-- 第二行：事件类型过滤、价格门槛与排序 -->
        <NFlex
          justify="space-between"
          align="center"
          wrap
          :size="10"
        >
          <!-- 类型多选标签 -->
          <NFlex
            align="center"
            wrap
            :size="6"
          >
            <span class="control-label">事件类型:</span>
            <NCheckboxGroup v-model:value="filterSelected">
              <NFlex :size="8" align="center" wrap>
                <NCheckbox :value="EventDataTypes.Message" size="small">弹幕</NCheckbox>
                <NCheckbox :value="EventDataTypes.Gift" size="small">礼物</NCheckbox>
                <NCheckbox :value="EventDataTypes.SC" size="small">SC</NCheckbox>
                <NCheckbox :value="EventDataTypes.Guard" size="small">舰长</NCheckbox>
                <NCheckbox :value="EventDataTypes.Enter" size="small">进场</NCheckbox>
              </NFlex>
            </NCheckboxGroup>
          </NFlex>

          <!-- 价格与排序 -->
          <NFlex
            align="center"
            wrap
            :size="8"
          >
            <span class="control-label">最低打赏:</span>
            <div class="price-pills">
              <span
                class="price-pill"
                :class="{ active: price === undefined }"
                @click="handlePriceQuickSelect(undefined)"
              >
                不限
              </span>
              <span
                class="price-pill"
                :class="{ active: price === 0.1 }"
                @click="handlePriceQuickSelect(0.1)"
              >
                ≥0.1
              </span>
              <span
                class="price-pill"
                :class="{ active: price === 1 }"
                @click="handlePriceQuickSelect(1)"
              >
                ≥1
              </span>
              <span
                class="price-pill"
                :class="{ active: price === 30 }"
                @click="handlePriceQuickSelect(30)"
              >
                ≥30
              </span>
              <span
                class="price-pill"
                :class="{ active: price === 100 }"
                @click="handlePriceQuickSelect(100)"
              >
                ≥100
              </span>
            </div>

            <NDivider vertical />

            <NCheckbox v-model:checked="orderDecreasing" size="small">
              时间倒序
            </NCheckbox>
            <NCheckbox v-model:checked="orderByPrice" size="small">
              按金额排序
            </NCheckbox>
          </NFlex>
        </NFlex>
      </NFlex>

      <!-- 底部状态计数条 -->
      <div class="danmaku-statusbar">
        <span class="status-meta">
          显示 <strong>{{ filteredDanmakuCount.toLocaleString() }}</strong> / {{ totalDanmakuCount.toLocaleString() }} 条事件
        </span>
        <span
          v-if="totalFilteredPrice > 0"
          class="status-income"
        >
          <NIcon :component="Money24Regular" />
          筛选范围打赏: <strong>¥{{ totalFilteredPrice.toLocaleString() }}</strong>
        </span>
      </div>
    </NCard>

    <!-- 弹幕虚拟列表渲染 -->
    <div
      class="danmaku-list-card"
      :class="{ 'with-border': props.showBorder }"
    >
      <div
        v-if="filteredDanmakus.length > 0"
        class="danmaku-scroll-area"
        :style="{ height: typeof props.height === 'number' ? `${props.height}px` : props.height }"
      >
        <SimpleVirtualList
          :default-size="28"
          :default-height="props.height"
          :items="filteredDanmakus"
        >
          <template #default="{ item }">
            <div class="danmaku-row-item">
              <DanmakuItem
                :danmaku="item"
                :account-info="accountInfo"
                :show-avatar="!hideAvatar"
                @on-click-name="onNameClick"
              />
            </div>
          </template>
        </SimpleVirtualList>
      </div>

      <div
        v-else
        class="empty-danmaku-box"
        :style="{ height: typeof props.height === 'number' ? `${props.height}px` : props.height }"
      >
        <NEmpty description="没有匹配的弹幕或事件记录" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmaku-container-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.user-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.danmaku-toolbar-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
}

.danmaku-search-input {
  width: 280px;
}

.control-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.price-pills {
  display: flex;
  align-items: center;
  gap: 4px;
}

.price-pill {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
  cursor: pointer;
  user-select: none;
  border: 1px solid var(--vtsuru-border);
  font-variant-numeric: tabular-nums;
  transition: all 0.15s ease;
}

.price-pill:hover {
  color: var(--vtsuru-brand);
  border-color: var(--vtsuru-brand);
}

.price-pill.active {
  background-color: var(--vtsuru-brand);
  color: #fff;
  border-color: var(--vtsuru-brand);
  font-weight: 600;
}

.danmaku-statusbar {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--vtsuru-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

.status-meta strong {
  color: var(--vtsuru-fg);
}

.status-income {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #10b981;
}

.status-income strong {
  color: #10b981;
}

.danmaku-list-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
  overflow: hidden;
}

.danmaku-list-card.with-border {
  border: 1px solid var(--vtsuru-border);
}

.danmaku-scroll-area {
  padding: 8px 12px;
}

.danmaku-row-item {
  padding: 2px 0;
  display: flex;
  align-items: center;
  min-height: 26px;
}

.empty-danmaku-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--vtsuru-fg);
}

@media (max-width: 768px) {
  .danmaku-search-input {
    width: 100%;
  }
}
</style>
