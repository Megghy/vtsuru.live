<script setup lang="ts">
import type {
  CountdownProps,
} from 'naive-ui'
import type { VideoCollectTable } from '@/api/api-models'
import { Clock24Regular, NumberRow24Regular } from '@vicons/fluent'
import {
  NCard, NCountdown, NDivider, NEllipsis, NIcon, NFlex, NTag, NText, NTime, NTooltip } from 'naive-ui';
import { CURRENT_HOST } from '@/shared/config'
import router from '@/app/router'

const props = defineProps<{
  item: VideoCollectTable
  canClick?: boolean
  from: 'user' | 'owner'
  bordered?: boolean
}>()
const renderCountdown: CountdownProps['render'] = (info: { hours: number, minutes: number, seconds: number }) => {
  return `${String(info.hours).padStart(2, '0')}时 ${String(info.minutes).padStart(2, '0')}分 ${String(info.seconds).padStart(2, '0')}秒`
}
function onClick() {
  if (props.canClick == true) {
    if (props.from == 'user') {
      window.open(`${CURRENT_HOST}video-collect/${props.item.shortId}`, '_blank')
    } else {
      router.push({ name: 'manage-videoCollect-Detail', params: { id: props.item.id } })
    }
  }
}
</script>

<template>
  <NCard
    size="small"
    style="width: 100%; cursor: pointer"
    embedded
    hoverable
    :bordered="bordered"
    @click="onClick"
  >
    <template #header>
      <NFlex :size="5">
        <NTag
          v-if="item.isFinish"
          size="small"
        >
          已结束
        </NTag>
        <NTag
          v-else
          type="success"
          size="small"
        >
          进行中
        </NTag>
        <NDivider vertical />
        {{ item.name }}
      </NFlex>
    </template>
    <template #header-extra>
      <slot name="header-extra" />
    </template>
    <NText
      depth="3"
      style="font-size: 13px"
    >
      <NTime :time="item.createAt" />
    </NText>
    <br>
    <NText
      depth="3"
      style="font-size: 13px"
    >
      结束:
      <NTime :time="item.endAt" />
    </NText>
    <br>
    <NText depth="3">
      <NEllipsis>
        {{ item.description }}
      </NEllipsis>
    </NText>
    <template #footer>
      <NFlex
        :size="5"
        align="center"
      >
        <NFlex>
          <NIcon :component="NumberRow24Regular" />
          <NTooltip>
            <template #trigger>
              <NText> {{ item.videoCount }} / {{ item.maxVideoCount }} </NText>
            </template>
            已征集数量 / 最大征集数量
          </NTooltip>
        </NFlex>
        <template v-if="!item.isFinish">
          <NDivider vertical />
          <NFlex>
            <NIcon :component="Clock24Regular" />
            <NTooltip>
              <template #trigger>
                <NText depth="3">
                  剩余 <NCountdown
                    :duration="item.endAt - Date.now()"
                    :render="renderCountdown"
                  />
                </NText>
              </template>
              结束于 <NTime :time="item.endAt" />
            </NTooltip>
          </NFlex>
        </template>
      </NFlex>
    </template>
  </NCard>
</template>
