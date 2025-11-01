<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
import type { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { Info12Filled, Money20Regular, Money24Regular, Search24Filled, Wrench24Filled } from '@vicons/fluent'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import {
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NCollapse,
  NCollapseItem,
  NCollapseTransition,
  NDivider,
  NIcon,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSkeleton,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import DanmakuItem from '@/components/DanmakuItem.vue'
import { GetString } from '@/data/DanmakuExport'
import router from '@/router'
import LiveInfoContainer from './LiveInfoContainer.vue'
import SimpleVirtualList from './SimpleVirtualList.vue'

enum RankType {
  Danmaku,
  Paid,
}

interface RankInfo {
  ouId: string
  uName: string
  Paid: number
  Danmakus: number
  Index: number
}

const {
  currentDanmakus,
  currentLive,
  defaultFilterSelected = [EventDataTypes.Gift, EventDataTypes.Guard, EventDataTypes.Message, EventDataTypes.SC],
  height = 1000,
  itemHeight = 30,
  showLiveInfo = true,
  showLiver = false,
  isInModal = false,
  showName = true,
  showBorder = true,
  showTools = true,
  showStatistic = true,
  animeNum = true,
  showRank = false,
  bordered = true,
  toolsVisiable = true,
  itemRange = 30,
  to = 'space',
} = defineProps<Props>()

const emit = defineEmits<{
  (e: 'onClickName', uId: number, ouId: string): boolean
}>()

const accountInfo = useAccount()
const message = useMessage()

const isLoading = ref(false)
const showModal = ref(false)
const showExportModal = ref(false)
const userDanmakus = ref<DanmakuModel[] | undefined>()
const hideAvatar = useLocalStorage('Setting.HideAvatar', false)

const keyword = ref('')
const enableRegex = ref(false)
const deselect = ref(false)
const price = ref<number | undefined>()
const filterSelected = ref(defaultFilterSelected)
const innerShowTools = ref(showTools)
const modalShowTools = ref(false)
const orderDecreasing = ref(false)
const orderByPrice = ref(false)
const processing = ref(false)
const isRanking = ref(false)
const rankType = ref(RankType.Danmaku)
const hideEmoji = ref(false)

const exportType = ref<'json' | 'xml' | 'csv'>('json')
const onlyExportFilteredDanmakus = ref(false)
const isExporting = ref(false)

let processingTimer: ReturnType<typeof setTimeout> | undefined

const baseDanmakus = shallowRef<DanmakuModel[]>([])
const dynamicDanmakus = shallowRef<DanmakuModel[]>([])

interface Props {
  currentLive: ResponseLiveInfoModel
  currentDanmakus: DanmakuModel[]
  defaultFilterSelected?: EventDataTypes[]
  height?: number
  itemHeight?: number
  showLiver?: boolean
  showLiveInfo?: boolean
  showName?: boolean
  isInModal?: boolean
  showRank?: boolean
  showBorder?: boolean
  showTools?: boolean
  showStatistic?: boolean
  animeNum?: boolean
  bordered?: boolean
  toolsVisiable?: boolean
  itemRange?: number
  to: 'userDanmakus' | 'space'
}

function createDanmakuSignature(danmaku: DanmakuModel, index: number) {
  const segments = []
  if (danmaku.ouId) segments.push(`ou_${danmaku.ouId}`)
  if (danmaku.uId) segments.push(`u_${danmaku.uId}`)
  if (danmaku.time) segments.push(`t_${danmaku.time}`)
  if (segments.length === 0) segments.push(`idx_${index}`)
  return segments.join('_')
}

function normalizeDanmakuList(source: DanmakuModel[] | undefined | null, existingIds?: Set<string>) {
  if (!source?.length) return []
  const usedIds = existingIds ?? new Set<string>()
  const normalized: DanmakuModel[] = []
  source.forEach((item, index) => {
    const baseId = item.id ?? createDanmakuSignature(item, index)
    let candidateId = baseId
    let suffix = 1
    while (usedIds.has(candidateId)) {
      candidateId = `${baseId}_${suffix++}`
    }
    normalized.push({
      ...item,
      id: candidateId,
    })
    usedIds.add(candidateId)
  })
  return normalized
}

function triggerProcessing(delay = 120) {
  processing.value = true
  if (processingTimer) {
    clearTimeout(processingTimer)
  }
  processingTimer = setTimeout(() => {
    processing.value = false
  }, delay)
}

function UpdateDanmakus() {
  triggerProcessing(80)
}

const debouncedFn = useDebounceFn(UpdateDanmakus, 750)

watch(
  () => showTools,
  (value) => {
    innerShowTools.value = value
  },
)

watch(
  () => rankType.value,
  () => {
    triggerProcessing(40)
  },
)

watch(
  () => currentDanmakus,
  (list) => {
    const normalized = normalizeDanmakuList(list)
    const baseIds = new Set(normalized.map(item => item.id))
    const filteredDynamic = dynamicDanmakus.value.filter(item => !baseIds.has(item.id))
    baseDanmakus.value = normalized
    if (filteredDynamic.length !== dynamicDanmakus.value.length) {
      dynamicDanmakus.value = filteredDynamic
    }
    triggerProcessing(normalized.length ? 80 : 0)
  },
  { immediate: true, deep: true },
)

const combinedDanmakus = computed(() => {
  if (!dynamicDanmakus.value.length) {
    return baseDanmakus.value
  }
  if (!baseDanmakus.value.length) {
    return dynamicDanmakus.value
  }
  return [...baseDanmakus.value, ...dynamicDanmakus.value]
})

const existEnterMessage = computed(() =>
  combinedDanmakus.value.some(item => item.type === EventDataTypes.Enter),
)

const filteredDanmakus = computed(() => {
  const source = combinedDanmakus.value
  if (!source.length) return []

  const selectedTypes = new Set(filterSelected.value)
  let working = source.filter(item => selectedTypes.has(item.type))

  if (hideEmoji.value) {
    working = working.filter(item => item.type !== EventDataTypes.Message || !item.isEmoji)
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
      const message = item.msg ?? ''
      if (!message) return false
      if (regex) {
        return regex.test(message)
      }
      return message.toLowerCase().includes(keywordLower)
    }
    working = working.filter(item => (deselect.value ? !matcher(item) : matcher(item)))
  }

  if (price.value && price.value > 0) {
    const minPrice = price.value
    working = working.filter(item => (item.price ?? 0) >= (minPrice ?? 0))
  }

  if (orderByPrice.value) {
    working = working
      .filter(item => item.type !== EventDataTypes.Message)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  } else {
    working = [...working].sort((a, b) => a.time - b.time)
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

const rankStats = computed(() => aggregateRankStats(combinedDanmakus.value))
const currentRankInfo = computed(() => buildRankedList(rankStats.value, rankType.value))

function aggregateRankStats(source: DanmakuModel[]): RankInfo[] {
  if (!source.length) return []
  const ranking = new Map<string, RankInfo>()
  source.forEach((item, index) => {
    const key = item.ouId || (item.uId != null ? `uid_${item.uId}` : `idx_${index}`)
    let info = ranking.get(key)
    if (!info) {
      info = {
        ouId: item.ouId || key,
        uName: item.uName ?? '未命名用户',
        Paid: 0,
        Danmakus: 0,
        Index: 0,
      }
      ranking.set(key, info)
    } else if (item.uName) {
      info.uName = item.uName
    }
    if (item.type === EventDataTypes.Message) {
      info.Danmakus += 1
    }
    if (typeof item.price === 'number') {
      info.Paid += item.price
    }
  })
  return Array.from(ranking.values())
}

function buildRankedList(stats: RankInfo[], type: RankType) {
  if (!stats.length) return []
  const filtered = stats
    .filter(info => (type === RankType.Paid ? info.Paid > 0 : true))
    .map(info => ({ ...info }))
  filtered.sort((a, b) =>
    type === RankType.Danmaku ? b.Danmakus - a.Danmakus : b.Paid - a.Paid,
  )
  const limited = filtered.slice(0, 100)
  limited.forEach((info, idx) => {
    info.Index = idx + 1
  })
  return limited
}

function OnNameClick(uId: number, ouId: string) {
  if (isInModal) {
    emit('onClickName', uId, ouId)
    return
  }
  const sourceDanmakus = combinedDanmakus.value
  switch (to) {
    case 'userDanmakus': {
      userDanmakus.value = sourceDanmakus.filter(d => (d.uId ? d.uId === uId : d.ouId === ouId))
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

function ToUserSpace(uId: number) {
  showModal.value = false
  nextTick(() => {
    router.push({
      name: 'user',
      params: {
        uid: uId,
      },
    })
  })
}

function ChangePrice(p: number) {
  if (p === price.value) {
    price.value = undefined
  } else {
    price.value = p
  }
  UpdateDanmakus()
}

function OnRank(isRank: boolean) {
  if (isRank) {
    triggerProcessing(60)
  }
}

function InsertDanmakus(targetDanmakus: DanmakuModel[]) {
  if (!Array.isArray(targetDanmakus) || targetDanmakus.length === 0) return
  const existingIds = new Set<string>([
    ...baseDanmakus.value.map(item => item.id),
    ...dynamicDanmakus.value.map(item => item.id),
  ])
  const normalized = normalizeDanmakuList(targetDanmakus, existingIds)
  if (!normalized.length) return
  dynamicDanmakus.value = orderDecreasing.value
    ? [...normalized, ...dynamicDanmakus.value]
    : [...dynamicDanmakus.value, ...normalized]
  triggerProcessing(40)
}

function Export() {
  isExporting.value = true
  const source = onlyExportFilteredDanmakus.value ? filteredDanmakus.value : combinedDanmakus.value
  saveAs(
    new Blob(
      [
        GetString(
          accountInfo.value,
          currentLive,
          source,
          exportType.value,
        ),
      ],
      { type: 'text/plain;charset=utf-8' },
    ),
    `${Date.now()}_${currentLive.startAt}_${currentLive.title.replace('_', '-')}_${accountInfo.value?.name}.${exportType.value}`,
  )
  isExporting.value = false
}

function GetRankIndexColor(index: number) {
  switch (index) {
    case 1:
      return `background:#fbda41;color:rgb(133,133,133);font-size:16px;`
    case 2:
      return `background:#c4d7d6;color:rgb(133,133,133);font-size:16px;`
    case 3:
      return `background:#f0d695;color:rgb(133,133,133);font-size:16px;`
    default:
      return 'background:#afafaf;'
  }
}

function RoundNumber(num: number) {
  if (Number.isInteger(num)) {
    return num
  }
  return num.toFixed(1)
}

onBeforeUnmount(() => {
  if (processingTimer) {
    clearTimeout(processingTimer)
  }
})

defineExpose({
  InsertDanmakus,
})
</script>

<template>
  <NSkeleton v-if="isLoading" />
  <NSpin
    v-else
    :show="processing"
  >
    <NModal
      v-model:show="showModal"
      preset="card"
      style="width: 600px;max-width: 90vw;max-height: 90vh;"
      content-style="overflow-y: auto"
      @after-leave="userDanmakus = undefined"
    >
      <template #header>
        {{ userDanmakus?.[0].uName }}
      </template>
      <template #header-extra>
        <NSwitch
          v-model:value="modalShowTools"
          size="small"
        >
          <template #checked>
            显示
          </template>
          <template #unchecked>
            隐藏
          </template>
          <template #icon>
            <NIcon :component="Wrench24Filled" />
          </template>
        </NSwitch>
      </template>
      <DanmakuContainer
        :show-live-info="false"
        :current-danmakus="userDanmakus ?? []"
        :current-live="currentLive"
        :height="500"
        :show-border="false"
        :show-tools="modalShowTools"
        to="space"
      />
    </NModal>
    <NModal
      v-model:show="showExportModal"
      preset="card"
      style="width: 500px; max-width: 90vw; height: auto"
    >
      <template #header>
        导出
      </template>
      <NSpin :show="isExporting">
        <NSpace
          vertical
          align="center"
        >
          <NRadioGroup
            v-model:value="exportType"
            style="margin: 0 auto"
          >
            <NRadioButton value="json">
              Json
            </NRadioButton>
            <NRadioButton value="xml">
              XML
            </NRadioButton>
            <NRadioButton value="csv">
              CSV
              <NTooltip>
                <template #trigger>
                  <NIcon>
                    <Info12Filled />
                  </NIcon>
                </template>
                只包含弹幕, 可在 Excel 中打开
              </NTooltip>
            </NRadioButton>
          </NRadioGroup>
          <NButton
            type="primary"
            size="large"
            @click="Export"
          >
            导出
          </NButton>
          <span />
          <NCollapse>
            <NCollapseItem
              title="关于"
              name="1"
            >
              <div>
                文件名格式: {<NTooltip>
                  <template #trigger>
                    生成时间
                  </template>Unix
                </NTooltip>}_{<NTooltip>
                  <template #trigger>
                    开始时间
                  </template>Unix: {{ currentLive.startAt }}
                </NTooltip>}_{<NTooltip>
                  <template #trigger>
                    直播间标题
                  </template>' _ ' 将被转义为 ' - '
                </NTooltip>}_{<NTooltip>
                  <template #trigger>
                    用户名
                  </template>{{ accountInfo?.name }}
                </NTooltip>}.{{ exportType }}
                <br>
                弹幕Type对应:
                <br>● 0 : 上舰 <br>● 1: sc <br>● 2: 礼物 <br>● 3: 弹幕
              </div>
            </NCollapseItem>
          </NCollapse>
          <span style="color: gray" />
        </NSpace>
      </NSpin>
    </NModal>
    <NCard
      style="height: 100%"
      embedded
      :bordered="bordered"
      content-style="padding: 12px"
    >
      <template #header>
        <slot name="header" />
      </template>
      <template #header-extra>
        <slot name="header-extra" />
      </template>
      <template v-if="showLiveInfo">
        <LiveInfoContainer
          :live="currentLive"
          :show-liver="showLiver"
          show-area
          :show-statistic="showStatistic"
        />
        <NDivider
          v-if="toolsVisiable"
          title-placement="left"
          style="font-size: 12px"
        >
          <NSwitch
            v-if="showRank"
            v-model:value="isRanking"
            size="small"
            @update-value="OnRank"
          >
            <template #checked>
              排行
            </template>
            <template #unchecked>
              弹幕
            </template>
          </NSwitch>
          <NDivider
            v-if="showRank && !isRanking"
            vertical
          />
          <Transition>
            <span v-if="!isRanking">
              <NSwitch
                v-model:value="innerShowTools"
                size="small"
              >
                <template #checked> 工具 </template>
                <template #unchecked> 工具 </template>
                <template #icon>
                  <NIcon :component="Wrench24Filled" />
                </template>
              </NSwitch>
            </span>
            <span v-else />
          </Transition>
        </NDivider>
        <br v-else>
      </template>
      <NCollapseTransition :show="innerShowTools && !isRanking">
        <NSpace
          vertical
          style="padding-bottom: 16px"
        >
          <NSpace align="center">
            <NButton
              type="primary"
              size="small"
              @click="showExportModal = true"
              @update:value="UpdateDanmakus"
            >
              导出
            </NButton>
            <NCheckbox
              v-model:checked="orderDecreasing"
              @update:checked="UpdateDanmakus"
            >
              降序
            </NCheckbox>
            <NCollapseTransition :show="filterSelected.includes(EventDataTypes.Message)">
              <NCheckbox
                v-model:checked="hideEmoji"
                @update:checked="UpdateDanmakus"
              >
                隐藏表情
              </NCheckbox>
            </NCollapseTransition>
            <NCheckbox v-model:checked="hideAvatar">
              隐藏头像
            </NCheckbox>
            <NCheckbox
              v-model:checked="orderByPrice"
              @update:checked="UpdateDanmakus"
            >
              按价格排序
            </NCheckbox>
          </NSpace>
          <NSpace align="center">
            <NInput
              v-model:value="keyword"
              size="small"
              style="max-width: 200px"
              placeholder="内容筛选"
              clearable
              @update:value="debouncedFn"
            >
              <template #prefix>
                <NIcon :component="Search24Filled" />
              </template>
            </NInput>
            <NCheckbox
              v-model:checked="enableRegex"
              @update:checked="UpdateDanmakus"
            >
              正则
            </NCheckbox>
            <NCheckbox
              v-model:checked="deselect"
              @update:checked="UpdateDanmakus"
            >
              反选
            </NCheckbox>
          </NSpace>
          <NSpace align="center">
            <NInputNumber
              v-model:value="price"
              placeholder="最低价格"
              size="small"
              style="max-width: 200px"
              clearable
              :min="0"
              @update:value="debouncedFn"
            >
              <template #prefix>
                <NIcon :component="Money20Regular" />
              </template>
            </NInputNumber>
            <NTag
              size="small"
              checkable
              :checked="price == 0.1"
              @update-checked="ChangePrice(0.1)"
            >
              0.1
            </NTag>
            <NTag
              size="small"
              checkable
              :checked="price == 1"
              @update-checked="ChangePrice(1)"
            >
              1
            </NTag>
            <NTag
              size="small"
              checkable
              :checked="price == 9.9"
              @update-checked="ChangePrice(9.9)"
            >
              9.9
            </NTag>
            <NTag
              size="small"
              checkable
              :checked="price == 30"
              @update-checked="ChangePrice(30)"
            >
              30
            </NTag>
            <NTag
              size="small"
              checkable
              :checked="price == 100"
              @update-checked="ChangePrice(100)"
            >
              100
            </NTag>
          </NSpace>
          <NCheckboxGroup
            v-model:value="filterSelected"
            @update:value="UpdateDanmakus"
          >
            <NSpace>
              <NCheckbox
                :value="EventDataTypes.Message"
                label="弹幕"
              />
              <NCheckbox
                :value="EventDataTypes.Gift"
                label="礼物"
              />
              <NCheckbox
                :value="EventDataTypes.Guard"
                label="舰长"
              />
              <NCheckbox
                :value="EventDataTypes.SC"
                label="Superchat"
              />

              <NCheckbox
                v-if="existEnterMessage"
                :value="EventDataTypes.Enter"
                label="入场"
              />
            </NSpace>
          </NCheckboxGroup>
        </NSpace>
        <NDivider
          style="margin-top: 0px; margin-bottom: 12px"
          title-placement="left"
        >
          <NTag
            style="font-size: 12px"
            size="small"
          >
            {{ filteredDanmakuCount }}
            {{ filteredDanmakuCount !== totalDanmakuCount ? `/ ${totalDanmakuCount}` : '' }}
            条
          </NTag>
          <NDivider vertical />
          <NTag
            style="font-size: 12px"
            size="small"
            type="error"
            :bordered="false"
          >
            💰
            {{ RoundNumber(totalFilteredPrice) }}
          </NTag>
        </NDivider>
      </NCollapseTransition>
      <div :style="isRanking ? 'display:none' : ''">
        <SimpleVirtualList
          v-if="filteredDanmakuCount > itemRange"
          :items="filteredDanmakus"
          :default-size="itemHeight"
          :default-height="height ?? 1000"
        >
          <template #default="{ item }">
            <p :style="`min-height: ${itemHeight}px;width:97%;display:flex;align-items:center;`">
              <DanmakuItem
                :danmaku="item"
                :account-info="accountInfo"
                :show-name="showName"
                :show-avatar="!hideAvatar"
                :height="itemHeight"
                @on-click-name="OnNameClick"
              />
            </p>
          </template>
        </SimpleVirtualList>
        <p
          v-for="item in filteredDanmakus"
          v-else
          :key="item.id"
          :style="`min-height: ${itemHeight}px;width:97%;display:flex;align-items:center;`"
        >
          <DanmakuItem
            :danmaku="item"
            :account-info="accountInfo"
            :show-name="showName"
            :show-avatar="!hideAvatar"
            :height="itemHeight"
            @on-click-name="OnNameClick"
          />
        </p>
      </div>
      <div v-if="isRanking">
        <NRadioGroup
          v-model:value="rankType"
          size="small"
        >
          <NRadioButton :value="RankType.Danmaku">
            弹幕
          </NRadioButton>
          <NRadioButton :value="RankType.Paid">
            付费
          </NRadioButton>
        </NRadioGroup>
        <NDivider />
        <NList
          :show-divider="false"
          style="background-color: rgba(255, 255, 255, 0)"
        >
          <NListItem
            v-for="user in currentRankInfo"
            :key="user.ouId"
          >
            <span style="display: flex; align-items: center">
              <NAvatar
                round
                size="small"
                :style="GetRankIndexColor(user.Index)"
              >
                {{ user.Index }}
              </NAvatar>
              <NDivider vertical />
              <NButton
                text
                type="info"
                @click="OnNameClick(accountInfo?.biliId ?? 0, user.ouId)"
              >
                <NTooltip v-if="user.uName == accountInfo?.name">
                  <template #trigger>
                    <NTag
                      size="small"
                      type="warning"
                      style="cursor: pointer"
                    >
                      {{ user.uName }}
                    </NTag>
                  </template>
                  主播
                </NTooltip>
                <template v-else>
                  {{ user.uName }}
                </template>
              </NButton>
              <NDivider vertical />
              <span v-if="rankType == RankType.Danmaku"> {{ user.Danmakus }} 条 </span>
              <span v-else-if="rankType == RankType.Paid">
                <NTag
                  size="small"
                  type="error"
                  :bordered="false"
                >
                  <NIcon :component="Money24Regular" />
                  {{ RoundNumber(user.Paid) }}
                </NTag>
              </span>
            </span>
          </NListItem>
        </NList>
      </div>
    </NCard>
  </NSpin>
</template>

<style>
.vListItem {
  min-height: 30px;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.3s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
