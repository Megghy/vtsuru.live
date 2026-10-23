<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Clock, Flame, Tv, User } from 'lucide-vue-next'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import { streamingInfo } from '@/apps/client/data/info'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Spin } from '@/shared/ui/spin'

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
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex-row items-center justify-between space-y-0">
      <CardTitle class="text-sm font-semibold">直播间信息</CardTitle>

      <div
        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
        :class="
          isStreaming
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-muted text-muted-foreground border-border'
        "
      >
        <span
          class="size-1.5 rounded-full"
          :class="isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'"
        />
        {{ isStreaming ? '直播中' : '未开播' }}
      </div>
    </CardHeader>

    <CardContent class="p-3">
      <Spin
        v-if="!streamingInfo"
        class="py-8"
        description="正在获取直播间信息..."
      />

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      >
        <!-- 直播间标题 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 sm:col-span-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Tv class="size-3.5" />
            <span>直播间标题</span>
          </div>
          <span class="text-xs font-semibold text-foreground block">
            {{ streamingInfo.title || '—' }}
          </span>
        </div>

        <!-- 主播 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User class="size-3.5" />
            <span>主播昵称</span>
          </div>
          <span class="text-xs font-medium text-foreground block">
            {{ accountInfo.streamerInfo?.name || '—' }}
          </span>
        </div>

        <!-- 人气 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame class="size-3.5" />
            <span>当前人气</span>
          </div>
          <span class="text-xs font-medium text-foreground block font-mono">
            {{ streamingInfo.online != null ? streamingInfo.online.toLocaleString() : '—' }}
          </span>
        </div>

        <!-- 开播时间 / 持续时长 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 sm:col-span-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5" />
            <span>开播时长</span>
          </div>
          <span class="text-xs font-medium text-foreground block">
            {{ streamingDuration }}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
