<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
import { useAccount } from '@/api/account'
import { DanmakuModel, EventDataTypes, ResponseLiveInfoModel } from '@/api/api-models'
import DanmakuItem from '@/components/DanmakuItem.vue'
import { GetString } from '@/data/DanmakuExport'
import router from '@/router'
import { Info12Filled, Money20Regular, Money24Regular, Search24Filled, Wrench24Filled } from '@vicons/fluent'
import { useDebounceFn, useLocalStorage, useWindowSize } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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

const accountInfo = useAccount()

const debouncedFn = useDebounceFn(() => {
  UpdateDanmakus()
}, 750)
const isLoading = ref(false)
const showModal = ref(false)
const showExportModal = ref(false)
const userDanmakus = ref<DanmakuModel[] | undefined>()
const hideAvatar = useLocalStorage('Setting.HideAvatar', false)
const { width } = useWindowSize()

interface Props {
  currentLive: ResponseLiveInfoModel
  currentDanmakus: DanmakuModel[]
  defaultFilterSelected?: EventDataTypes[]
  height?: number
  itemHeight?: number
  showLiver?: boolean
  showLiveInfo?: boolean
  showName?: boolean
  //to?: ClickNameTo;
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

const {
  currentDanmakus,
  currentLive,
  defaultFilterSelected = [EventDataTypes.Gift, EventDataTypes.Guard, EventDataTypes.Message, EventDataTypes.SC],
  height = 1000,
  itemHeight = 30,
  showLiveInfo = true,
  showLiver = false,
  //to = ClickNameTo.UserHistory,
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
defineExpose({
  InsertDanmakus,
})
const danmakus = ref<DanmakuModel[]>([])
watch(
  () => showTools,
  (newV, oldV) => {
    innerShowTools.value = newV
  },
)
const danmakuRef = computed(() => {
  //不知道为啥不能直接watch
  return currentDanmakus
})
watch(danmakuRef, (newValue) => {
  danmakus.value = GetFilteredDanmakus(newValue)
})

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
const rankInfo = ref<RankInfo[]>([])
const currentRankInfo = ref<RankInfo[]>([])
const rankType = ref(RankType.Danmaku)
const hideEmoji = ref(false)
const existEnterMessage = ref(false)

const exportType = ref<'json' | 'xml' | 'csv'>('json')
const onlyExportFilteredDanmakus = ref(false)
const isExporting = ref(false)
const message = useMessage()

function OnNameClick(uId: number, ouId: string) {
  if (isInModal) {
    emit('onClickName', uId, ouId)
    return
  }
  switch (to) {
    case 'userDanmakus': {
      userDanmakus.value = currentDanmakus.filter((d) => (d.uId ? d.uId == uId : d.ouId == ouId))
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
        window.open('https://space.bilibili.com/' + uId, '_blank')
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
  if (p == price.value) price.value = undefined
  else {
    price.value = p
  }
  UpdateDanmakus()
}
function UpdateDanmakus() {
  processing.value = true
  nextTick(() => {
    setTimeout(() => {
      canInsert = false
      danmakus.value = GetFilteredDanmakus()
      setTimeout(() => {
        canInsert = true
      }, 1000) //立马就能的话会莫名key重复
      processing.value = false
    }, 50)
  })
}
function OnRank(isRank: boolean) {
  if (isRank) OnRankDirect(rankType.value, rankInfo.value.length == 0 && danmakus.value.length > 0)
}
function OnRankDirect(type: RankType, refresh: boolean, orderByDescending = true) {
  if (refresh) {
    var rank = {} as {
      [ouId: string]: RankInfo
    }
    currentDanmakus.forEach((danmaku) => {
      if (danmaku.ouId in rank) {
        if (danmaku.type == EventDataTypes.Message) rank[danmaku.ouId].Danmakus++
        rank[danmaku.ouId].Paid += danmaku.price ?? 0
      } else {
        rank[danmaku.ouId] = {
          //uId: danmaku.uId,
          ouId: danmaku.ouId,
          uName: danmaku.uName,
          Paid: danmaku.price ?? 0,
          Danmakus: danmaku.type == EventDataTypes.Message ? 1 : 0,
          Index: 0,
        }
      }
    })
    rankInfo.value = new List(Object.entries(rank)).Select(([uId, user]) => user).ToArray()
  }
  var ienum = {} as List<RankInfo>
  switch (rankType.value) {
    case RankType.Danmaku: {
      ienum = new List(rankInfo.value).OrderByDescending((user) => user.Danmakus)
      break
    }
    case RankType.Paid: {
      ienum = new List(rankInfo.value).Where((user) => (user?.Paid ?? 0) > 0).OrderByDescending((user) => user.Paid)
      break
    }
  }
  if (!orderByDescending) ienum = ienum.Reverse()
  currentRankInfo.value = ienum.Take(100).ToArray()
  var index = 1
  currentRankInfo.value.forEach((info) => {
    info.Index = index
    index++
  })
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
function Export() {
  isExporting.value = true
  saveAs(
    new Blob(
      [
        GetString(
          accountInfo.value,
          currentLive,
          onlyExportFilteredDanmakus.value ? danmakus.value : currentDanmakus,
          exportType.value,
        ),
      ],
      { type: 'text/plain;charset=utf-8' },
    ),
    `${Date.now()}_${currentLive.startAt}_${currentLive.title.replace('_', '-')}_${accountInfo.value?.name}.${exportType.value}`,
  )
  isExporting.value = false
}
let canInsert = false
function InsertDanmakus(targetDanmakus: DanmakuModel[]) {
  if (processing.value || !canInsert) {
    return
  }
  var data = GetFilteredDanmakus(targetDanmakus)
  if (orderDecreasing.value) {
    danmakus.value.unshift(...data)
    currentDanmakus.unshift(...data)
  } else {
    danmakus.value.push(...data)
    currentDanmakus.push(...data)
  }
}
function GetFilteredDanmakus(targetDanmakus?: DanmakuModel[]) {
  if (!targetDanmakus) targetDanmakus = currentDanmakus
  var tempDanmakus = targetDanmakus.filter((d) => filterSelected.value.includes(d.type))
  if (hideEmoji.value) {
    tempDanmakus = tempDanmakus.filter((d) => d.type != EventDataTypes.Message || !d.isEmoji)
  }
  if (orderByPrice.value) {
    tempDanmakus = tempDanmakus
      .filter((d) => d.type != EventDataTypes.Message)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  } else {
    tempDanmakus = tempDanmakus.sort((a, b) => a.time - b.time)
  }

  if (keyword.value && keyword.value != '') {
    tempDanmakus = tempDanmakus.filter((d) => (deselect.value ? !CheckKeyword(d) : CheckKeyword(d)))
  }
  function CheckKeyword(d: DanmakuModel) {
    if (d.uId.toString() == keyword.value || d.uName == keyword.value) {
      return true
    }
    return enableRegex.value
      ? d.msg?.match(keyword.value)
        ? true
        : false
      : d.msg?.toLowerCase().includes(keyword.value.toLowerCase()) == true
  }
  if (price.value && price.value > 0) {
    tempDanmakus = tempDanmakus.filter((d) => (d.price ?? 0) >= (price.value ?? 0))
  }
  if (orderDecreasing.value) tempDanmakus = tempDanmakus.reverse()
  var index = 0
  tempDanmakus.forEach((d) => {
    d.id = `${d.ouId}_${d.time}_${index}`
    index++
  })
  return tempDanmakus
}
function RoundNumber(num: number) {
  if (Number.isInteger(num)) {
    return num
  } else {
    return num.toFixed(1)
  }
}

onMounted(() => {
  danmakus.value = GetFilteredDanmakus()
  existEnterMessage.value = danmakus.value.some((d) => d.type == EventDataTypes.Message)
  //defaultFilterSelected.push(EventDataTypes.Enter)
})
</script>

<template>
  <NSkeleton v-if="isLoading"> </NSkeleton>
  <NSpin v-else :show="processing">
    <NModal
      v-model:show="showModal"
      @after-leave="userDanmakus = undefined"
      preset="card"
      :style="'width: 600px;max-width: 90vw;max-height: 90vh;'"
      content-style="overflow-y: auto"
    >
      <template #header>
        {{ userDanmakus?.[0].uName }}
      </template>
      <template #header-extra>
        <NSwitch v-model:value="modalShowTools" size="small">
          <template #checked> 显示 </template>
          <template #unchecked> 隐藏 </template>
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
    <NModal v-model:show="showExportModal" preset="card" style="width: 500px; max-width: 90vw; height: auto">
      <template #header> 导出 </template>
      <NSpin :show="isExporting">
        <NSpace vertical align="center">
          <NRadioGroup v-model:value="exportType" style="margin: 0 auto">
            <NRadioButton value="json"> Json </NRadioButton>
            <NRadioButton value="xml"> XML </NRadioButton>
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
          <NButton type="primary" size="large" @click="Export"> 导出 </NButton>
          <span></span>
          <NCollapse>
            <NCollapseItem title="关于" name="1">
              <div>
                文件名格式: {<NTooltip><template #trigger>生成时间</template>Unix</NTooltip>}_{<NTooltip
                  ><template #trigger>开始时间</template>Unix: {{ currentLive.startAt }} </NTooltip
                >}_{<NTooltip><template #trigger>直播间标题</template>' _ ' 将被转义为 ' - '</NTooltip>}_{<NTooltip
                  ><template #trigger>用户名</template>{{ accountInfo?.name }}</NTooltip
                >}.{{ exportType }}
                <br />
                弹幕Type对应:
                <br />● 0 : 上舰 <br />● 1: sc <br />● 2: 礼物 <br />● 3: 弹幕
              </div>
            </NCollapseItem>
          </NCollapse>
          <span style="color: gray"> </span>
        </NSpace>
      </NSpin>
    </NModal>
    <NCard style="height: 100%" embedded :bordered="bordered" content-style="padding: 12px">
      <template #header>
        <slot name="header"> </slot>
      </template>
      <template #header-extra>
        <slot name="header-extra"> </slot>
      </template>
      <template v-if="showLiveInfo">
        <LiveInfoContainer :live="currentLive" :show-liver="showLiver" show-area :show-statistic="showStatistic" />
        <NDivider title-placement="left" style="font-size: 12px" v-if="toolsVisiable">
          <NSwitch v-if="showRank" v-model:value="isRanking" @update-value="OnRank" size="small">
            <template #checked> 排行 </template>
            <template #unchecked> 弹幕 </template>
          </NSwitch>
          <NDivider v-if="showRank && !isRanking" vertical />
          <Transition>
            <span v-if="!isRanking">
              <NSwitch v-model:value="innerShowTools" size="small">
                <template #checked> 工具 </template>
                <template #unchecked> 工具 </template>
                <template #icon>
                  <NIcon :component="Wrench24Filled" />
                </template>
              </NSwitch>
            </span>
            <span v-else></span>
          </Transition>
        </NDivider>
        <br v-else />
      </template>
      <NCollapseTransition :show="innerShowTools && !isRanking">
        <NSpace vertical style="padding-bottom: 16px">
          <NSpace align="center">
            <NButton type="primary" size="small" @click="showExportModal = true" @update:value="UpdateDanmakus">
              导出
            </NButton>
            <NCheckbox v-model:checked="orderDecreasing" @update:checked="UpdateDanmakus"> 降序 </NCheckbox>
            <NCollapseTransition :show="filterSelected.includes(EventDataTypes.Message)">
              <NCheckbox v-model:checked="hideEmoji" @update:checked="UpdateDanmakus"> 隐藏表情 </NCheckbox>
            </NCollapseTransition>
            <NCheckbox v-model:checked="hideAvatar"> 隐藏头像 </NCheckbox>
            <NCheckbox v-model:checked="orderByPrice" @update:checked="UpdateDanmakus"> 按价格排序 </NCheckbox>
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
            <NCheckbox v-model:checked="enableRegex" @update:checked="UpdateDanmakus"> 正则 </NCheckbox>
            <NCheckbox v-model:checked="deselect" @update:checked="UpdateDanmakus"> 反选 </NCheckbox>
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
            <NTag size="small" checkable :checked="price == 0.1" @update-checked="ChangePrice(0.1)"> 0.1 </NTag>
            <NTag size="small" checkable :checked="price == 1" @update-checked="ChangePrice(1)"> 1 </NTag>
            <NTag size="small" checkable :checked="price == 9.9" @update-checked="ChangePrice(9.9)"> 9.9 </NTag>
            <NTag size="small" checkable :checked="price == 30" @update-checked="ChangePrice(30)"> 30 </NTag>
            <NTag size="small" checkable :checked="price == 100" @update-checked="ChangePrice(100)"> 100 </NTag>
          </NSpace>
          <NCheckboxGroup v-model:value="filterSelected" @update:value="UpdateDanmakus">
            <NSpace>
              <NCheckbox :value="EventDataTypes.Message" label="弹幕" />
              <NCheckbox :value="EventDataTypes.Gift" label="礼物" />
              <NCheckbox :value="EventDataTypes.Guard" label="舰长" />
              <NCheckbox :value="EventDataTypes.SC" label="Superchat" />

              <NCheckbox v-if="existEnterMessage" :value="EventDataTypes.Enter" label="入场" />
            </NSpace>
          </NCheckboxGroup>
        </NSpace>
        <NDivider style="margin-top: 0px; margin-bottom: 12px" title-placement="left">
          <NTag style="font-size: 12px" size="small">
            {{ danmakus.length }}
            {{ danmakus.length != currentDanmakus.length ? `/ ${currentDanmakus.length}` : '' }}
            条
          </NTag>
          <NDivider vertical />
          <NTag style="font-size: 12px" size="small" type="error" :bordered="false">
            💰
            {{ RoundNumber(danmakus.reduce((a, b) => a + (b.price && b.price > 0 ? b.price : 0), 0)) }}
          </NTag>
        </NDivider>
      </NCollapseTransition>
      <div :style="isRanking ? 'display:none' : ''">
        <SimpleVirtualList
          v-if="danmakus.length > itemRange"
          :items="danmakus"
          :default-size="itemHeight"
          :default-height="height ?? 1000"
        >
          <template #default="{ item }">
            <p :style="`min-height: ${itemHeight}px;width:97%;display:flex;align-items:center;`">
              <DanmakuItem
                :danmaku="item"
                :account-info="accountInfo"
                @on-click-name="OnNameClick"
                :show-name="showName"
                :show-avatar="!hideAvatar"
                :height="itemHeight"
              />
            </p>
          </template>
        </SimpleVirtualList>
        <p
          v-else
          v-for="item in danmakus"
          :style="`min-height: ${itemHeight}px;width:97%;display:flex;align-items:center;`"
          v-bind:key="item.id"
        >
          <DanmakuItem
            :danmaku="item"
            :account-info="accountInfo"
            @on-click-name="OnNameClick"
            :show-name="showName"
            :show-avatar="!hideAvatar"
            :height="itemHeight"
          />
        </p>
      </div>
      <div v-if="isRanking">
        <NRadioGroup
          v-model:value="rankType"
          @update:value="
            (type) => {
              OnRankDirect(type, false)
            }
          "
          size="small"
        >
          <NRadioButton :value="RankType.Danmaku"> 弹幕 </NRadioButton>
          <NRadioButton :value="RankType.Paid"> 付费 </NRadioButton>
        </NRadioGroup>
        <NDivider />
        <NList :show-divider="false" style="background-color: rgba(255, 255, 255, 0)">
          <NListItem v-for="user in currentRankInfo" v-bind:key="user.ouId">
            <span style="display: flex; align-items: center">
              <NAvatar round size="small" :style="GetRankIndexColor(user.Index)">
                {{ user.Index }}
              </NAvatar>
              <NDivider vertical />
              <NButton text type="info" @click="OnNameClick(accountInfo?.biliId ?? 0, user.ouId)">
                <NTooltip v-if="user.uName == accountInfo?.name">
                  <template #trigger>
                    <NTag size="small" type="warning" style="cursor: pointer">
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
                <NTag size="small" type="error" :bordered="false">
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
