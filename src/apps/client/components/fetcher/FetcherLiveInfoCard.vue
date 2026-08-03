<script setup lang="ts">
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
  <UCard
    title="直播间信息"
    size="small"
    bordered
    style="width: 100%"
  >
    <template #header-extra>
      <UBadge
        v-if="isStreaming"
        type="success"
        size="small"
      >
        <template #leading>
          <UIcon name="i-lucide-circle" />
        </template>
        直播中
      </UBadge>
      <UBadge
        v-else
        type="default"
        size="small"
      >
        未开播
      </UBadge>
    </template>
    <div
      :show="!streamingInfo"
      description="正在获取直播间信息..."
    >
      <div
        v-if="streamingInfo"
        label-placement="top"
        bordered
        :columns="2"
        size="small"
      >
        <div label="直播间标题">
          <span :line-clamp="2">
            {{ streamingInfo.title ?? 'N/A' }}
          </span>
        </div>
        <div label="主播"><UIcon name="i-lucide-circle" /> {{ accountInfo.streamerInfo?.name ?? 'N/A' }}</div>
        <div label="人气"><UIcon name="i-lucide-circle" /> {{ streamingInfo.online?.toLocaleString() ?? 'N/A' }}</div>
        <div label="开播时间"><UIcon name="i-lucide-circle" /> {{ streamingDuration }}</div>
      </div>
      <UEmpty
        v-else
        description="暂无直播间信息"
        style="padding: 16px 0"
      />
    </div>
  </UCard>
</template>
