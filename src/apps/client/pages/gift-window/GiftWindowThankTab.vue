<script setup lang="ts">
import { Copy, Ship, Trophy } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { GuardLevel } from '@/api/generated/model'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'

const giftWindow = useGiftWindow()

const realtimeRankList = computed(() => giftWindow.getRankedList())
const realtimeGuardList = computed(() => giftWindow.getOnlineGuardList())
const realtimeViewerList = computed(() => giftWindow.getOnlineViewerList())

function getGuardTitle(level: GuardLevel): string {
  switch (level) {
    case GuardLevel.Zongdu:
      return '总督'
    case GuardLevel.Tidu:
      return '提督'
    case GuardLevel.Jianzhang:
      return '舰长'
    default:
      return ''
  }
}

function copyThankText() {
  const ranked = realtimeRankList.value
  const guards = realtimeGuardList.value

  const lines: string[] = []
  lines.push(`【本场打赏贡献榜 Top ${ranked.length}】`)
  if (ranked.length === 0) {
    lines.push('(暂无打赏记录)')
  } else {
    ranked.forEach((r, idx) => {
      const guardStr = r.guardLevel > 0 ? ` [${getGuardTitle(r.guardLevel)}]` : ''
      const onlineStr = r.isOnline ? ' (在场)' : ''
      lines.push(`${idx + 1}. ${r.uname} - ¥${r.score}${guardStr}${onlineStr}`)
    })
  }

  lines.push('')
  lines.push(`【在场大航海名单 (共 ${guards.length} 人)】`)
  if (guards.length === 0) {
    lines.push('(暂无在场大航海记录)')
  } else {
    guards.forEach((g) => {
      lines.push(`- ${g.uname} [${getGuardTitle(g.guardLevel)}] (${g.lastAction})`)
    })
  }

  const viewers = realtimeViewerList.value
  lines.push('')
  lines.push(`【在场陪伴与在线观众 (共 ${viewers.length} 人)】`)
  if (viewers.length === 0) {
    lines.push('(暂无在线观众数据)')
  } else {
    viewers.forEach((v) => {
      const formerStr = v.isFormerGuard ? ' [老舰长]' : ''
      const medalStr = v.medalLevel ? ` [${v.medalName || '粉丝'} Lv.${v.medalLevel}]` : ''
      lines.push(`- ${v.uname}${formerStr}${medalStr} (${v.lastAction})`)
    })
  }

  navigator.clipboard
    .writeText(lines.join('\n'))
    .then(() => {
      toast.success('已复制下播感谢文案至剪贴板')
    })
    .catch(() => {
      toast.error('复制到剪贴板失败')
    })
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between">
      <CardTitle>本场打赏前 50 与在场舰长名单</CardTitle>
      <Button
        variant="secondary"
        class="gap-1 text-primary"
        @click="copyThankText"
      >
        <Copy class="size-3.5" />
        一键复制感谢文案
      </Button>
    </CardHeader>

    <CardContent class="p-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 左列: 本场打赏榜 Top 50 -->
        <div>
          <div class="flex-between mb-2">
            <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Trophy class="size-4 text-amber-500" />
              本场打赏贡献榜 (前 {{ realtimeRankList.length }} 名)
            </span>
            <Badge
              variant="warning"
              size="xs"
            >
              上限 {{ giftWindow.settings.rankDisplayCount }} 人
            </Badge>
          </div>

          <div class="max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
            <Empty
              v-if="realtimeRankList.length === 0"
              description="本场暂无打赏记录"
              class="py-8"
            />
            <div
              v-else
              class="flex flex-col gap-1.5"
            >
              <div
                v-for="(r, idx) in realtimeRankList"
                :key="r.id"
                class="p-2 px-3 rounded-md bg-popover border border-border transition-colors duration-150 hover:border-primary"
                :class="{ 'border-amber-500/35 bg-amber-500/5': idx < 3 }"
              >
                <div class="flex-between w-full">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-5 font-bold text-xs text-center text-muted-foreground"
                      :class="{
                        'text-amber-500': idx === 0,
                        'text-slate-400': idx === 1,
                        'text-amber-700 dark:text-amber-600': idx === 2,
                      }"
                    >
                      {{ idx + 1 }}
                    </span>
                    <div class="relative flex-center">
                      <img
                        :src="r.uface || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'"
                        referrerpolicy="no-referrer"
                        class="size-6 rounded-full object-cover"
                        alt="avatar"
                      />
                      <span
                        class="absolute -right-0.5 -bottom-0.5 size-1.75 rounded-full bg-slate-400 border-[1.5px] border-popover"
                        :class="{ 'bg-emerald-500 shadow-[0_0_4px_#22c55e]': r.isOnline }"
                        :title="r.isOnline ? '在场活跃' : '离线'"
                      />
                    </div>
                    <span class="text-xs font-semibold text-foreground">{{ r.uname }}</span>
                    <Badge
                      v-if="r.guardLevel > 0"
                      variant="outline"
                      size="xs"
                      :class="
                        r.guardLevel === GuardLevel.Zongdu
                          ? 'text-destructive border-destructive/40 bg-destructive/10'
                          : r.guardLevel === GuardLevel.Tidu
                            ? 'text-amber-600 border-amber-500/40 bg-amber-500/10'
                            : 'text-sky-600 border-sky-500/40 bg-sky-500/10'
                      "
                    >
                      {{ getGuardTitle(r.guardLevel) }}
                    </Badge>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <Badge
                      v-if="r.isOnline"
                      variant="success"
                      size="xs"
                    >
                      在场
                    </Badge>
                    <span class="text-xs font-bold text-amber-500"> ¥{{ r.score.toLocaleString() }} </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右列: 还在直播间的在场舰长 -->
        <div>
          <div class="flex-between mb-2">
            <span class="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Ship class="size-4 text-sky-500" />
              还在直播间的舰长 ({{ realtimeGuardList.length }} 人)
            </span>
            <span class="text-[11px] text-muted-foreground">
              {{ giftWindow.settings.onlineThresholdMinutes }} 分钟内有互动
            </span>
          </div>

          <div class="max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
            <Empty
              v-if="realtimeGuardList.length === 0"
              description="当前暂无在场大航海观众活跃"
              class="py-8"
            />
            <div
              v-else
              class="flex flex-col gap-1.5"
            >
              <div
                v-for="g in realtimeGuardList"
                :key="g.id"
                class="p-2 px-3 rounded-md bg-popover border border-sky-500/30 bg-sky-500/5"
              >
                <div class="flex-between w-full">
                  <div class="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      size="xs"
                      :class="
                        g.guardLevel === GuardLevel.Zongdu
                          ? 'text-destructive border-destructive/40 bg-destructive/10'
                          : g.guardLevel === GuardLevel.Tidu
                            ? 'text-amber-600 border-amber-500/40 bg-amber-500/10'
                            : 'text-sky-600 border-sky-500/40 bg-sky-500/10'
                      "
                    >
                      {{ getGuardTitle(g.guardLevel) }}
                    </Badge>
                    <div class="relative flex-center">
                      <img
                        :src="g.uface || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'"
                        referrerpolicy="no-referrer"
                        class="size-6 rounded-full object-cover"
                        alt="avatar"
                      />
                      <span
                        class="absolute -right-0.5 -bottom-0.5 size-1.75 rounded-full border-[1.5px] border-popover bg-emerald-500 shadow-[0_0_4px_#22c55e]"
                      />
                    </div>
                    <span class="text-xs font-semibold text-foreground">{{ g.uname }}</span>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-muted-foreground">
                      {{ g.lastAction }}
                    </span>
                    <Badge
                      v-if="g.rankIndex"
                      variant="warning"
                      size="xs"
                    >
                      榜 #{{ g.rankIndex }}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
