<script setup lang="ts">
import { Clock, Heart, MessageSquare, ShieldOff, Users, Wallet } from 'lucide-vue-next'
import { format } from 'date-fns'
import { computed, watch } from 'vue'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'

import { useOrgContext } from '../composables/useOrgContext'
import type { useStreamerDetail } from '../composables/useOrgStreamers'
import { DEFAULT_COVER, formatDate, formatMinutes, streamerStatusBadgeClass, streamerStatusLabel } from '../utils'
import OrgUserAvatar from './OrgUserAvatar.vue'

const props = defineProps<{ detail: ReturnType<typeof useStreamerDetail> }>()
const emit = defineEmits<{ (e: 'saved'): void }>()

const { isOrgAdmin, canViewRevenue } = useOrgContext()
const d = props.detail

watch([() => d.show.value, () => d.selectedId.value], ([show, id]) => {
  if (show && id) void d.load(true)
})

const maxHeatmapValue = computed(() => {
  const vals = (d.detail.value?.heatmap || []).map((h) => h.value || 0)
  return Math.max(1, ...vals)
})

const heatmapLegend = [0, 0.2, 0.45, 0.7, 1]

function getHeatmapColor(val: number) {
  if (!val) return 'var(--muted)'
  const ratio = Math.min(1, val / maxHeatmapValue.value)
  if (ratio < 0.25) return 'color-mix(in srgb, #10b981 30%, transparent)'
  if (ratio < 0.5) return 'color-mix(in srgb, #10b981 55%, transparent)'
  if (ratio < 0.75) return 'color-mix(in srgb, #10b981 78%, transparent)'
  return '#10b981'
}

function handleDaysChange(val: string) {
  d.days.value = Number(val)
  void d.load(true)
}
</script>

<template>
  <Sheet v-model:open="d.show.value">
    <SheetContent
      side="right"
      class="sm:max-w-lg w-full p-4 flex flex-col gap-3 overflow-hidden"
    >
      <!-- pr-8 避免与 Sheet 默认右上角关闭按钮重叠 -->
      <SheetHeader class="pb-3 pr-8 border-b border-border/60 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <OrgUserAvatar
            :face-url="d.detail.value?.streamer.faceUrl"
            :size="40"
          />
          <div class="min-w-0 flex-1 flex flex-col">
            <SheetTitle class="text-sm truncate text-foreground">
              {{ d.detail.value?.streamer.name || (d.selectedId.value ? `ID: ${d.selectedId.value}` : '主播详情') }}
            </SheetTitle>
            <span class="text-xs text-muted-foreground font-mono">
              ID: {{ d.detail.value?.streamer.id || d.selectedId.value || '-' }}
            </span>
          </div>

          <div
            v-if="d.detail.value"
            class="flex items-center gap-1.5 shrink-0"
          >
            <Badge
              variant="outline"
              size="xs"
              :class="streamerStatusBadgeClass(d.detail.value.status)"
            >
              {{ streamerStatusLabel(d.detail.value.status) }}
            </Badge>
            <Badge
              v-if="d.detail.value.status === 1 && d.detail.value.allowPointManage === false"
              variant="secondary"
              size="xs"
            >
              仅直播数据
            </Badge>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea class="flex-1 min-h-0 pr-2 [&_[data-reka-scroll-area-viewport]>div]:!block">
        <div
          v-if="d.loading.value && !d.detail.value"
          class="py-12 flex-center"
        >
          <Spin />
        </div>
        <div
          v-else-if="!d.detail.value"
          class="py-10"
        >
          <Empty description="暂无数据" />
        </div>
        <div
          v-else
          class="space-y-3.5 text-xs pb-2"
        >
          <!-- 统计周期选择 -->
          <div class="flex-between gap-2">
            <span class="text-muted-foreground">统计周期</span>
            <Select
              :model-value="String(d.days.value)"
              @update:model-value="handleDaysChange(String($event))"
            >
              <SelectTrigger class="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">近 30 天</SelectItem>
                <SelectItem value="90">近 90 天</SelectItem>
                <SelectItem value="180">近 180 天</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 统计指标网格 -->
          <div class="grid grid-cols-2 gap-2">
            <Card v-if="canViewRevenue">
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">总收入（含航海）</span>
                <span class="text-base font-semibold font-mono tabular-nums text-primary">
                  ¥{{ d.detail.value.summary.totalIncomeWithGuard.toFixed(2) }}
                </span>
                <span class="text-[11px] text-muted-foreground block font-mono tabular-nums">
                  付费人数: {{ d.detail.value.summary.uniquePayingUsers ?? 0 }}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">直播时长 / 场次</span>
                <span class="text-base font-semibold font-mono tabular-nums text-foreground">
                  {{ formatMinutes(d.detail.value.summary.liveDurationMinutes) }}
                </span>
                <span class="text-[11px] text-muted-foreground block font-mono tabular-nums">
                  共 {{ d.detail.value.summary.liveCount ?? 0 }} 场
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">互动人次 / 去重</span>
                <span class="text-base font-semibold font-mono tabular-nums text-foreground">
                  {{ d.detail.value.summary.interactionCount }}
                </span>
                <span class="text-[11px] text-muted-foreground block font-mono tabular-nums">
                  去重用户: {{ d.detail.value.summary.uniqueInteractionUsers ?? 0 }}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-3 space-y-0.5">
                <span class="text-[11px] text-muted-foreground block">弹幕 / 点赞</span>
                <span class="text-base font-semibold font-mono tabular-nums text-foreground">
                  {{ d.detail.value.summary.danmakuCount }}
                </span>
                <span class="text-[11px] text-muted-foreground inline-flex items-center gap-1 font-mono tabular-nums">
                  <Heart class="size-3" />
                  {{ d.detail.value.summary.likeCount ?? 0 }}
                </span>
              </CardContent>
            </Card>
          </div>

          <!-- 直播热力图 -->
          <Card>
            <CardHeader class="p-3 border-b border-border/60 flex flex-row items-center justify-between gap-2">
              <CardTitle class="text-xs font-semibold">直播时间热力图（近 {{ d.days.value }} 天）</CardTitle>
              <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>少</span>
                <span
                  v-for="(r, idx) in heatmapLegend"
                  :key="idx"
                  class="size-2.5 rounded-xs inline-block"
                  :style="{ backgroundColor: getHeatmapColor(r * maxHeatmapValue) }"
                />
                <span>多</span>
              </div>
            </CardHeader>
            <CardContent class="p-3">
              <Empty
                v-if="!d.detail.value.heatmap?.length"
                description="暂无热力图数据"
                class="py-4"
              />
              <div
                v-else
                class="flex flex-wrap gap-1"
              >
                <div
                  v-for="item in d.detail.value.heatmap"
                  :key="item.date"
                  class="size-3 rounded-xs transition-colors"
                  :style="{ backgroundColor: getHeatmapColor(item.value) }"
                  :title="`${formatDate(item.date)}: ${formatMinutes(item.value)}`"
                />
              </div>
            </CardContent>
          </Card>

          <!-- 主播管理（管理员权限） -->
          <Card v-if="isOrgAdmin">
            <CardHeader class="p-3 border-b border-border/60">
              <CardTitle class="text-xs font-semibold">主播管理</CardTitle>
            </CardHeader>
            <CardContent class="p-3 space-y-3">
              <Alert
                v-if="d.detail.value.status !== 1"
                size="sm"
                variant="warning"
              >
                <AlertDescription>
                  当前主播状态为「{{ streamerStatusLabel(d.detail.value.status) }}」。为保障主播隐私与自主权，如需重新建立授权，请在主播管理页重新发送邀请并由主播本人同意。
                </AlertDescription>
              </Alert>

              <FormField
                label="内部备注"
                description="仅组织管理员可见，最多 200 字"
              >
                <Textarea
                  v-model="d.editNote.value"
                  rows="2"
                  :maxlength="200"
                  placeholder="记录分组、档期或沟通备注..."
                  class="resize-none"
                />
              </FormField>

              <div class="flex-between gap-2 flex-wrap">
                <Button
                  :disabled="d.saving.value"
                  @click="d.saveNote(() => emit('saved'))"
                >
                  {{ d.saving.value ? '保存中...' : '保存备注' }}
                </Button>

                <Popconfirm
                  v-if="d.detail.value.status === 1"
                  title="确认解除该主播绑定吗？解除后将立即停止读取其直播与积分数据。"
                  positive-text="确认解除"
                  negative-text="取消"
                  @positive-click="d.removeFromOrg(() => emit('saved'))"
                >
                  <template #trigger>
                    <Button
                      variant="outline"
                      class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                      :disabled="d.saving.value"
                    >
                      <ShieldOff class="size-3.5" />
                      解除绑定
                    </Button>
                  </template>
                </Popconfirm>
              </div>
            </CardContent>
          </Card>

          <!-- 直播记录 -->
          <Card>
            <CardHeader class="p-3 border-b border-border/60 flex flex-row items-center justify-between gap-2">
              <CardTitle class="text-xs font-semibold">直播记录</CardTitle>
              <span class="text-[11px] text-muted-foreground font-mono tabular-nums">
                {{ d.lives.value.length }}<template v-if="typeof d.detail.value.totalLives === 'number'"> / {{ d.detail.value.totalLives }}</template> 场
              </span>
            </CardHeader>
            <CardContent class="p-3">
              <div
                v-if="d.lives.value.length === 0"
                class="py-6"
              >
                <Empty description="暂无直播记录" />
              </div>
              <div
                v-else
                class="divide-y divide-border/60"
              >
                <div
                  v-for="live in d.lives.value"
                  :key="live.liveId"
                  class="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5"
                >
                  <ImagePreview
                    v-if="live.coverUrl"
                    :src="live.coverUrl"
                    :alt="live.title"
                    class="w-24 h-14 rounded border border-border/60 shrink-0"
                  />
                  <img
                    v-else
                    :src="DEFAULT_COVER"
                    referrerpolicy="no-referrer"
                    class="w-24 h-14 rounded object-cover border border-border/60 shrink-0"
                    alt=""
                  />
                  <div class="min-w-0 flex-1 space-y-1">
                    <strong class="font-medium text-foreground text-xs block truncate">
                      {{ live.title }}
                    </strong>
                    <div class="flex items-center gap-1 text-[11px] text-muted-foreground font-mono tabular-nums">
                      <Clock class="size-3 shrink-0" />
                      <span>{{ format(live.startAt, 'yyyy-MM-dd HH:mm') }}</span>
                      <template v-if="live.stopAt">
                        <span>- {{ format(live.stopAt, 'HH:mm') }}</span>
                      </template>
                      <template v-else-if="!live.isFinish">
                        <span class="text-emerald-500">· 直播中</span>
                      </template>
                    </div>
                    <div class="flex items-center gap-3 text-[11px] text-muted-foreground font-mono tabular-nums flex-wrap">
                      <span
                        v-if="canViewRevenue"
                        class="inline-flex items-center gap-1"
                      >
                        <Wallet class="size-3" />
                        ¥{{ live.totalIncomeWithGuard.toFixed(0) }}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <Users class="size-3" />
                        {{ live.interactionCount }}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <MessageSquare class="size-3" />
                        {{ live.danmakusCount }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-if="d.hasMore.value"
                  class="pt-3 flex-center"
                >
                  <Button
                    variant="outline"
                    :disabled="d.loading.value"
                    @click="d.loadMore"
                  >
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
