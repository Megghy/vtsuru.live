<script setup lang="ts">
import { PeopleOutline, PersonCircleOutline, TimeOutline, TvOutline } from '@vicons/ionicons5'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'
import { useAccount } from '@/api/account'
import { streamingInfo } from '@/apps/client/data/info'

const accountInfo = useAccount()

const isStreaming = computed(() => streamingInfo.value?.status === 'streaming')
const streamingDuration = computed(() => {
  if (isStreaming.value && streamingInfo.value?.streamAt) {
    return formatDistanceToNow(streamingInfo.value.streamAt, { locale: zhCN, addSuffix: true })
  }
  return '未开播'
})
</script>

<template>
  <NCard title="直播间信息" size="small" bordered style="width: 100%;">
    <template #header-extra>
      <NTag v-if="isStreaming" type="success" size="small">
        <template #icon>
          <NIcon :component="TvOutline" />
        </template>
        直播中
      </NTag>
      <NTag v-else type="default" size="small">
        未开播
      </NTag>
    </template>
    <NSpin :show="!streamingInfo" description="正在获取直播间信息...">
      <NDescriptions
        v-if="streamingInfo"
        label-placement="top"
        bordered
        :columns="2"
        size="small"
      >
        <NDescriptionsItem label="直播间标题">
          <NEllipsis :line-clamp="2">
            {{ streamingInfo.title ?? 'N/A' }}
          </NEllipsis>
        </NDescriptionsItem>
        <NDescriptionsItem label="主播">
          <NIcon :component="PersonCircleOutline" /> {{ accountInfo.streamerInfo?.name ?? 'N/A' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="人气">
          <NIcon :component="PeopleOutline" /> {{ streamingInfo.online?.toLocaleString() ?? 'N/A' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="开播时间">
          <NIcon :component="TimeOutline" /> {{ streamingDuration }}
        </NDescriptionsItem>
      </NDescriptions>
      <NEmpty
        v-else
        description="暂无直播间信息"
        style="padding: 16px 0;"
      />
    </NSpin>
  </NCard>
</template>
