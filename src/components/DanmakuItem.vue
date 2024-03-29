<script setup lang="ts">
import { AccountInfo, DanmakuModel, EventDataTypes } from '@/api/api-models'
import { Money24Regular, VehicleShip24Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { NButton, NCard, NDivider, NIcon, NTag, NTooltip } from 'naive-ui'

function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}
function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138) return ''
    if (price >= 138 && price < 1598) return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998) return 'rgb(157, 155, 255)'
    if (price >= 15998) return 'rgb(122, 4, 35)'
  }
  return ''
}

const {
  danmaku,
  accountInfo,
  height = 30,
  showName = true,
  showAvatar = true,
} = defineProps<{
  danmaku: DanmakuModel
  accountInfo: AccountInfo | undefined
  showName?: boolean
  showAvatar?: boolean
  height?: number
}>()
defineEmits<{
  (e: 'onClickName', uId: number, ouId: string): void
}>()
</script>

<template>
  <NCard
    v-if="danmaku.type == EventDataTypes.SC"
    :style="`margin-top: 5px;margin-bottom: 5px;max-width:500px;background-color: ${GetSCColor(danmaku.price ?? 0)};`"
    content-style="border-radius: 3px;padding:5px;min-height:45px;display:flex;align-items:center;"
    :header-style="`padding:5px;background: rgba(255, 255, 255, 15%);font-size: 14px;`"
    size="small"
    hoverable
  >
    <template #header>
      <div>
        <span style="display: flex; align-items: center; gap: 8px 8px">
          <NTooltip v-if="danmaku.uId > 0 && showAvatar">
            <template #trigger>
              <img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=25`" alt="头像" referrerpolicy="no-referrer" style="border-radius: 50%" loading="lazy" />
            </template>
            <img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`" alt="头像" referrerpolicy="no-referrer" loading="lazy" />
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <span style="color: white">
                {{ format(danmaku.time, 'HH:mm:ss') }}
              </span>
            </template>
            {{ format(danmaku.time, 'yyyy-MM-dd HH:mm:ss') }}
          </NTooltip>
          <NButton v-if="showName" text type="primary" @click="$emit('onClickName', danmaku.uId, danmaku.ouId)">
            <NTag v-if="danmaku.uId == accountInfo?.biliId" size="small" type="warning">
              {{ danmaku.uName }}
            </NTag>
            <template v-else>
              <span style="color: white; font-weight: bold; text-shadow: rgb(124 59 59) 2px 2px 1px">
                {{ danmaku.uName }}
              </span>
            </template>
          </NButton>
          <NTag
            size="small"
            :style="`display:flex;margin-left: auto;background-color: ${GetSCColor(danmaku.price ?? 0)};color: #e1e1e1;min-width: 35px;justify-content:center;text-shadow: rgb(124 59 59) 2px 2px 1px;`"
            :bordered="false"
          >
            {{ danmaku.price }}
          </NTag>
        </span>
      </div>
    </template>
    <span style="color: white">
      {{ danmaku.msg }}
    </span>
  </NCard>
  <template v-else>
    <span class="danmaku-item" style="display: flex; align-items: center; white-space: nowrap; margin-left: 5px; color: gray">
      <NTooltip v-if="danmaku.uId > 0 && showAvatar">
        <template #trigger>
          <img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=22`" alt="头像" referrerpolicy="no-referrer" style="border-radius: 50%; margin-right: 5px" />
        </template>
        <img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`" alt="头像" referrerpolicy="no-referrer" />
      </NTooltip>
      <NTooltip>
        <template #trigger>
          {{ format(danmaku.time, 'HH:mm:ss') }}
        </template>
        {{ format(danmaku.time, 'yyyy-MM-dd HH:mm:ss') }}
      </NTooltip>
    </span>
    <span>
      <template v-if="showName && danmaku.uId != -1">
        <NButton class="danmaku-item" text type="info" @click="$emit('onClickName', danmaku.uId, danmaku.ouId)">
          <NTooltip v-if="danmaku.uId == accountInfo?.biliId">
            <template #trigger>
              <NTag size="small" type="warning" style="cursor: pointer">
                {{ danmaku.uName && danmaku.uName != '' ? danmaku.uName : '主播' }}
              </NTag>
            </template>
            主播
          </NTooltip>
          <template v-else>
            <span :style="danmaku.uName != '' && !showAvatar ? 'min-width: 60px' : ''">
              {{ danmaku.uName }}
              <span style="color: gray">
                {{ ': ' }}
              </span>
            </span>
          </template>
        </NButton>
      </template>
      <span v-if="danmaku.type == EventDataTypes.Message">
        <template v-if="danmaku.isEmoji">
          <NTooltip>
            <template #trigger>
              <img :src="'https://' + danmaku.msg + `@22h`" referrerpolicy="no-referrer" :style="`max-height: ${height}px;display:inline-flex;`" />
            </template>
            <img :src="'https://' + danmaku.msg ?? ''" referrerpolicy="no-referrer" />
          </NTooltip>
        </template>
        <template v-else>
          {{ danmaku.msg }}
        </template>
      </span>
      <span v-else-if="danmaku.type == EventDataTypes.Gift" :style="'color:' + ((danmaku.price ?? 0) > 0 ? '#DD2F2F' : '#E9A8A8')">
        <NTag size="tiny" v-if="(danmaku.price ?? 0) > 0" type="error" :bordered="false"> <NIcon :component="Money24Regular" /> {{ danmaku.price }} </NTag>
        {{ danmaku.price ?? 0 > 0 ? '' : '免费' }}礼物
        <NDivider vertical />
        {{ danmaku.msg }}
        <NTag size="tiny" :bordered="false" v-if="danmaku.num">
          <span style="color: gray"> {{ danmaku.num }} 个 </span>
        </NTag>
      </span>
      <span v-else-if="danmaku.type == EventDataTypes.Guard" style="color: #9d78c1">
        上舰
        <NTag size="small" :style="`color:${GetGuardColor(danmaku.price ?? 0)}`"> <NIcon :component="VehicleShip24Filled" /> {{ danmaku.price }} </NTag>
        <NDivider vertical />
        {{ danmaku.msg }}
      </span>
      <span
        v-else-if="danmaku.type == EventDataTypes.Enter"
        style="color: forestgreen"
      >
        进入直播间
      </span>
    </span>
  </template>
</template>

<style>
.danmaku-item {
  margin-right: 5px;
}
</style>
