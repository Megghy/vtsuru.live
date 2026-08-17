<script setup lang="ts">
import { Clock24Regular, NumberRow24Regular } from '@vicons/fluent'
import { useNow } from '@vueuse/core'
import type { CountdownProps } from 'naive-ui'
import { NCard, NCountdown, NDivider, NEllipsis, NIcon, NFlex, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { computed } from 'vue'

import type { VideoCollectTable } from '@/api/api-models'
import router from '@/app/router'
import { CURRENT_HOST } from '@/shared/config'

const props = defineProps<{
  item: VideoCollectTable
  canClick?: boolean
  from: 'user' | 'owner'
  bordered?: boolean
}>()
const now = useNow({ interval: 1000 })
const isUpcoming = computed(() => !props.item.isFinish && props.item.startAt > now.value.getTime())
const renderCountdown: CountdownProps['render'] = (info: { hours: number; minutes: number; seconds: number }) => {
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
    :class="{ 'is-clickable': canClick }"
    embedded
    :hoverable="canClick"
    :bordered="bordered"
    :tabindex="canClick ? 0 : undefined"
    :role="canClick ? 'link' : undefined"
    :aria-label="canClick ? `打开视频征集：${item.name}` : undefined"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <template #header>
      <NFlex :size="5">
        <NTag v-if="item.isFinish"> 已结束 </NTag>
        <NTag
          v-else-if="isUpcoming"
          type="info"
          size="small"
        >
          未开始
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
    <br />
    <NText
      v-if="isUpcoming"
      depth="3"
      style="font-size: 13px"
    >
      开放:
      <NTime :time="item.startAt" />
    </NText>
    <br v-if="isUpcoming" />
    <NText
      depth="3"
      style="font-size: 13px"
    >
      结束:
      <NTime :time="item.endAt" />
    </NText>
    <br />
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
            已占用名额 / 最大视频数（待审核 + 已通过）
          </NTooltip>
        </NFlex>
        <template v-if="!item.isFinish">
          <NDivider vertical />
          <NFlex>
            <NIcon :component="Clock24Regular" />
            <NTooltip>
              <template #trigger>
                <NText depth="3">
                  {{ isUpcoming ? '开放倒计时' : '剩余' }}
                  <NCountdown
                    :duration="(isUpcoming ? item.startAt : item.endAt) - now.getTime()"
                    :render="renderCountdown"
                  />
                </NText>
              </template>
              {{ isUpcoming ? '开放于' : '结束于' }}
              <NTime :time="isUpcoming ? item.startAt : item.endAt" />
            </NTooltip>
          </NFlex>
        </template>
      </NFlex>
    </template>
  </NCard>
</template>

<style scoped>
.is-clickable {
  width: 100%;
  cursor: pointer;
}

.is-clickable:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary-focus, var(--vtsuru-brand));
  outline-offset: 3px;
}
</style>
