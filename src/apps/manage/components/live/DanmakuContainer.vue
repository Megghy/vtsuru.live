<script setup lang="ts">
import { DocumentArrowDown20Regular, Money24Regular, Search24Filled } from '@vicons/fluent'
import { saveAs } from 'file-saver'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { GetString } from '@/apps/manage/components/live/danmakuExport'
import DanmakuItem from '@/apps/manage/components/live/DanmakuItem.vue'
import SimpleVirtualList from '@/apps/manage/components/live/SimpleVirtualList.vue'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useMessage } from '@/shared/utils'

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

function toggleTypeFilter(type: EventDataTypes) {
  const idx = filterSelected.value.indexOf(type)
  if (idx > -1) {
    filterSelected.value.splice(idx, 1)
  } else {
    filterSelected.value.push(type)
  }
}

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
      `${Date.now()}_${props.currentLive.startAt}_${props.currentLive.title.replace(/[/\\]/g, '-')}_${accountInfo.value?.name ?? 'live'}.${exportType.value}`,
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
    ...baseDanmakus.value.map((item) => String(item.id ?? '')),
    ...dynamicDanmakus.value.map((item) => String(item.id ?? '')),
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
    <Dialog v-model:open="showModal">
      <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">
            观众「{{ userDanmakus?.[0]?.uName || '未知用户' }}」在本场的发言 ({{ userDanmakus?.length || 0 }} 条)
          </DialogTitle>
        </DialogHeader>
        <div class="flex-1 overflow-y-auto mt-2">
          <DanmakuContainer
            :current-danmakus="userDanmakus ?? []"
            :current-live="props.currentLive"
            height="480px"
            :show-border="false"
            to="space"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- 弹幕导出弹窗 -->
    <Dialog v-model:open="showExportModal">
      <DialogContent class="max-w-md p-4">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">导出弹幕数据</DialogTitle>
        </DialogHeader>
        <div
          v-if="isExporting"
          class="py-6 flex justify-center"
        >
          <Spin />
        </div>
        <div
          v-else
          class="flex flex-col gap-4 py-2"
        >
          <div>
            <div class="text-xs text-muted-foreground mb-2">选择导出格式</div>
            <div class="grid grid-cols-3 gap-2">
              <Button
                :variant="exportType === 'json' ? 'default' : 'outline'"
                @click="exportType = 'json'"
              >
                JSON 完整
              </Button>
              <Button
                :variant="exportType === 'xml' ? 'default' : 'outline'"
                @click="exportType = 'xml'"
              >
                XML 标准
              </Button>
              <Button
                :variant="exportType === 'csv' ? 'default' : 'outline'"
                @click="exportType = 'csv'"
              >
                CSV 表格
              </Button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Checkbox
              id="export-filtered"
              :checked="onlyExportFilteredDanmakus"
              @update:checked="onlyExportFilteredDanmakus = $event"
            />
            <label
              for="export-filtered"
              class="text-xs cursor-pointer"
            >
              仅导出当前筛选后的弹幕 (当前 {{ filteredDanmakuCount }} 条)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="showExportModal = false"
          >
            取消
          </Button>
          <Button
            :disabled="isExporting"
            @click="handleExport"
          >
            立即导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 筛选控制工具条 (Bento Style) -->
    <Card class="p-3">
      <div class="flex flex-col gap-2.5">
        <!-- 第一行：搜索与类型快速过滤 -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <!-- 搜索输入 -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative w-64">
              <component
                :is="Search24Filled"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
              />
              <Input
                v-model="keyword"
                placeholder="搜索发言内容、用户名或 UID..."
                class="pl-8"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-regex"
                :checked="enableRegex"
                @update:checked="enableRegex = $event"
              />
              <label
                for="filter-regex"
                class="text-xs cursor-pointer select-none"
                >正则</label
              >
            </div>

            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-deselect"
                :checked="deselect"
                @update:checked="deselect = $event"
              />
              <label
                for="filter-deselect"
                class="text-xs cursor-pointer select-none"
                >反选</label
              >
            </div>
          </div>

          <!-- 右侧：导出与视图选项 -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-hide-emoji"
                :checked="hideEmoji"
                @update:checked="hideEmoji = $event"
              />
              <label
                for="filter-hide-emoji"
                class="text-xs cursor-pointer select-none"
                >隐藏表情</label
              >
            </div>

            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-hide-avatar"
                :checked="hideAvatar"
                @update:checked="hideAvatar = $event"
              />
              <label
                for="filter-hide-avatar"
                class="text-xs cursor-pointer select-none"
                >隐藏头像</label
              >
            </div>

            <div class="h-4 w-px bg-border" />

            <Button
              variant="outline"
              @click="showExportModal = true"
            >
              <component
                :is="DocumentArrowDown20Regular"
                class="size-3.5 mr-1"
              />
              导出弹幕
            </Button>
          </div>
        </div>

        <!-- 第二行：事件类型过滤、价格门槛与排序 -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <!-- 类型多选标签 -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground">事件类型:</span>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                <Checkbox
                  :checked="filterSelected.includes(EventDataTypes.Message)"
                  @update:checked="toggleTypeFilter(EventDataTypes.Message)"
                />
                弹幕
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                <Checkbox
                  :checked="filterSelected.includes(EventDataTypes.Gift)"
                  @update:checked="toggleTypeFilter(EventDataTypes.Gift)"
                />
                礼物
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                <Checkbox
                  :checked="filterSelected.includes(EventDataTypes.SC)"
                  @update:checked="toggleTypeFilter(EventDataTypes.SC)"
                />
                SC
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                <Checkbox
                  :checked="filterSelected.includes(EventDataTypes.Guard)"
                  @update:checked="toggleTypeFilter(EventDataTypes.Guard)"
                />
                舰长
              </label>
              <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                <Checkbox
                  :checked="filterSelected.includes(EventDataTypes.Enter)"
                  @update:checked="toggleTypeFilter(EventDataTypes.Enter)"
                />
                进场
              </label>
            </div>
          </div>

          <!-- 价格与排序 -->
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="text-xs text-muted-foreground">最低打赏:</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] border transition-colors select-none"
                :class="
                  price === undefined
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click="handlePriceQuickSelect(undefined)"
              >
                不限
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] border transition-colors select-none"
                :class="
                  price === 0.1
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click="handlePriceQuickSelect(0.1)"
              >
                ≥0.1
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] border transition-colors select-none"
                :class="
                  price === 1
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click="handlePriceQuickSelect(1)"
              >
                ≥1
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] border transition-colors select-none"
                :class="
                  price === 30
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click="handlePriceQuickSelect(30)"
              >
                ≥30
              </button>
              <button
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] border transition-colors select-none"
                :class="
                  price === 100
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                "
                @click="handlePriceQuickSelect(100)"
              >
                ≥100
              </button>
            </div>

            <div class="h-4 w-px bg-border" />

            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-order-dec"
                :checked="orderDecreasing"
                @update:checked="orderDecreasing = $event"
              />
              <label
                for="filter-order-dec"
                class="text-xs cursor-pointer select-none"
                >时间倒序</label
              >
            </div>

            <div class="flex items-center gap-1.5">
              <Checkbox
                id="filter-order-price"
                :checked="orderByPrice"
                @update:checked="orderByPrice = $event"
              />
              <label
                for="filter-order-price"
                class="text-xs cursor-pointer select-none"
                >按金额排序</label
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态计数条 -->
      <div
        class="mt-2.5 pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground font-mono"
      >
        <span>
          显示 <strong class="text-foreground">{{ filteredDanmakuCount.toLocaleString() }}</strong> /
          {{ totalDanmakuCount.toLocaleString() }} 条事件
        </span>
        <span
          v-if="totalFilteredPrice > 0"
          class="flex items-center gap-1 text-emerald-500"
        >
          <component
            :is="Money24Regular"
            class="size-3.5"
          />
          筛选范围打赏: <strong>¥{{ totalFilteredPrice.toLocaleString() }}</strong>
        </span>
      </div>
    </Card>

    <!-- 弹幕虚拟列表渲染 -->
    <div
      class="danmaku-list-card bg-card rounded-lg overflow-hidden"
      :class="{ 'border border-border': props.showBorder }"
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
        class="py-12 flex justify-center items-center"
        :style="{ height: typeof props.height === 'number' ? `${props.height}px` : props.height }"
      >
        <Empty description="没有匹配的弹幕或事件记录" />
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
</style>
