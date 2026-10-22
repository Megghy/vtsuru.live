<script setup lang="ts">
import {
  ChatbubblesOutline,
  PeopleOutline,
  TimeOutline,
  WalletOutline,
} from '@vicons/ionicons5'
import { format } from 'date-fns'
import { computed, watch } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'

import { useOrgContext } from '../composables/useOrgContext'
import type { useStreamerDetail } from '../composables/useOrgStreamers'
import { DEFAULT_COVER, formatDate, streamerStatusLabel } from '../utils'
import OrgUserAvatar from './OrgUserAvatar.vue'

const props = defineProps<{ detail: ReturnType<typeof useStreamerDetail> }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const { isOrgAdmin } = useOrgContext()
const d = props.detail

watch([() => d.show.value, () => d.selectedId.value], ([show, id]) => {
  if (show && id) d.load(true)
})

const maxHeatmapValue = computed(() => {
  const vals = (d.detail.value?.heatmap || []).map((h) => h.value || 0)
  return Math.max(1, ...vals)
})

function getHeatmapColor(val: number) {
  if (!val) return 'var(--muted)'
  const ratio = Math.min(1, val / maxHeatmapValue.value)
  if (ratio < 0.25) return 'rgba(16, 185, 129, 0.3)'
  if (ratio < 0.5) return 'rgba(16, 185, 129, 0.55)'
  if (ratio < 0.75) return 'rgba(16, 185, 129, 0.75)'
  return 'rgba(16, 185, 129, 1)'
}
</script>

<template>
  <Sheet v-model:open="d.show.value">
    <SheetContent
      side="right"
      class="sm:max-w-lg w-full p-4 flex flex-col gap-3"
    >
      <SheetHeader class="pb-2 border-b border-border/60">
        <div class="flex items-center gap-3">
          <OrgUserAvatar
            :face-url="d.detail.value?.streamer.faceUrl"
            :size="40"
          />
          <div class="min-w-0 flex-1 flex flex-col">
            <SheetTitle class="text-sm font-semibold truncate text-foreground">
              {{ d.detail.value?.streamer.name || (d.selectedId.value ? `ID: ${d.selectedId.value}` : '主播详情') }}
            </SheetTitle>
            <span class="text-xs text-muted-foreground font-mono">
              ID: {{ d.detail.value?.streamer.id || d.selectedId.value || '-' }}
            </span>
          </div>

          <Badge
            v-if="d.detail.value"
            variant="secondary"
            class="text-[10px] h-4.5 px-1.5 font-normal ml-auto"
          >
            {{ streamerStatusLabel(d.detail.value.status) }}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1 pr-2">
        <div v-if="d.loading.value && !d.detail.value" class="py-12 flex justify-center">
          <Spin />
        </div>
        <div v-else-if="!d.detail.value" class="py-10">
          <Empty description="暂无数据" />
        </div>
        <div v-else class="space-y-3.5 text-xs">
          <!-- 统计指标网格 -->
          <div class="grid grid-cols-2 gap-2">
            <Card class="border border-border/80">
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">总收入</span>
                <span class="text-base font-semibold font-mono text-primary">
                  ¥{{ d.detail.value.summary.totalIncomeWithGuard.toFixed(2) }}
                </span>
              </CardContent>
            </Card>

            <Card class="border border-border/80">
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">直播时长</span>
                <span class="text-base font-semibold font-mono text-foreground">
                  {{ d.detail.value.summary.liveDurationMinutes }} <span class="text-xs font-normal text-muted-foreground">min</span>
                </span>
              </CardContent>
            </Card>

            <Card class="border border-border/80">
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">互动人次</span>
                <span class="text-base font-semibold font-mono text-foreground">
                  {{ d.detail.value.summary.interactionCount }}
                </span>
              </CardContent>
            </Card>

            <Card class="border border-border/80">
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">弹幕数量</span>
                <span class="text-base font-semibold font-mono text-foreground">
                  {{ d.detail.value.summary.danmakuCount }}
                </span>
              </CardContent>
            </Card>
          </div>

          <!-- 直播热力图 -->
          <Card class="border border-border/80">
            <CardHeader class="p-3 pb-2 border-b border-border/60">
              <CardTitle class="text-xs font-semibold">直播时间热力图</CardTitle>
            </CardHeader>
            <CardContent class="p-3">
              <div class="flex flex-wrap gap-1">
                <div
                  v-for="item in d.detail.value.heatmap"
                  :key="item.date"
                  class="size-3.5 rounded-xs transition-colors cursor-pointer"
                  :style="{ backgroundColor: getHeatmapColor(item.value) }"
                  :title="`${formatDate(item.date)}: ${item.value ?? 0} min`"
                />
              </div>
            </CardContent>
          </Card>

          <!-- 主播设置（管理员权限） -->
          <Card v-if="isOrgAdmin" class="border border-border/80">
            <CardHeader class="p-3 pb-2 border-b border-border/60">
              <CardTitle class="text-xs font-semibold">主播设置</CardTitle>
            </CardHeader>
            <CardContent class="p-3 space-y-3">
              <div class="space-y-1">
                <label class="font-medium text-foreground text-xs">状态</label>
                <Select
                  :model-value="String(d.editStatus.value ?? 1)"
                  @update:model-value="d.editStatus.value = Number($event)"
                >
                  <SelectTrigger class="w-40">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" class="text-xs">Active</SelectItem>
                    <SelectItem value="3" class="text-xs">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="space-y-1">
                <label class="font-medium text-foreground text-xs">备注</label>
                <Textarea
                  v-model="d.editNote.value"
                  rows="2"
                  placeholder="仅组织管理员可见"
                  class="text-xs resize-none"
                />
              </div>

              <Button :disabled="d.saving.value" @click="d.save(() => emit('saved'))"
              >
                {{ d.saving.value ? '保存中...' : '保存设置' }}
              </Button>
            </CardContent>
          </Card>

          <!-- 直播记录 -->
          <Card class="border border-border/80">
            <CardHeader class="p-3 pb-2 border-b border-border/60">
              <CardTitle class="text-xs font-semibold">直播记录</CardTitle>
            </CardHeader>
            <CardContent class="p-3">
              <div v-if="d.lives.value.length === 0" class="py-6">
                <Empty description="暂无直播记录" />
              </div>
              <div v-else class="divide-y divide-border/60 space-y-2">
                <div
                  v-for="live in d.lives.value"
                  :key="live.liveId"
                  class="pt-2 first:pt-0 flex items-start gap-2.5"
                >
                  <img
                    :src="live.coverUrl || DEFAULT_COVER"
                    referrerpolicy="no-referrer"
                    class="w-24 h-14 rounded object-cover border border-border/60 shrink-0"
                    alt=""
                    @error="(e) => ((e.target as HTMLImageElement).src = DEFAULT_COVER)"
                  />
                  <div class="min-w-0 flex-1 space-y-1">
                    <strong class="font-medium text-foreground text-xs block truncate">
                      {{ live.title }}
                    </strong>
                    <div class="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <component :is="TimeOutline" class="size-3 inline" />
                      <span>{{ format(live.startAt, 'yyyy-MM-dd HH:mm') }}</span>
                      <template v-if="live.stopAt">
                        <span>- {{ format(live.stopAt, 'HH:mm') }}</span>
                      </template>
                    </div>
                    <div class="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span class="inline-flex items-center gap-1">
                        <component :is="WalletOutline" class="size-3" />
                        {{ live.totalIncomeWithGuard.toFixed(0) }}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <component :is="PeopleOutline" class="size-3" />
                        {{ live.interactionCount }}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <component :is="ChatbubblesOutline" class="size-3" />
                        {{ live.danmakusCount }}
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="d.hasMore.value" class="pt-3 flex justify-center">
                  <Button variant="outline" :disabled="d.loading.value" @click="d.loadMore">
                    {{ d.loading.value ? '加载中...' : '加载更多' }}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
