<script setup lang="ts">
import {
  Copy,
  Crown,
  Dices,
  Download,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
} from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import {
  getOptionVoters,
  type VoteOptionDtoModel,
  VoteResultMode,
  type VoteSessionModel,
} from '@/api/vote'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { formatContribution, getVoteStandings } from '@/shared/utils/voteStandings'

const props = defineProps<{
  items: VoteSessionModel[]
  loading: boolean
  hasMore: boolean
  keyword: string
  resultMode: VoteResultMode
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  search: []
  loadMore: []
  reuse: [session: VoteSessionModel]
  delete: [id: number]
  tiebreakDraw: [sessionId: number]
}>()

const detailSession = ref<VoteSessionModel | null>(null)

function getStandingsFor(session: VoteSessionModel) {
  const dtos: VoteOptionDtoModel[] = (session.options ?? []).map((opt, idx) => ({
    index: idx + 1,
    text: opt.text,
    count: opt.count,
    contribution: opt.contribution ?? 0,
    percentage: session.totalVotes > 0 ? (opt.count / session.totalVotes) * 100 : 0,
  }))
  return getVoteStandings(dtos, props.resultMode, session.winnerOverride)
}

function formatTime(unixSec?: number | null) {
  if (!unixSec) return '-'
  const ms = unixSec > 1e12 ? unixSec : unixSec * 1000
  return new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function exportCsv(session: VoteSessionModel) {
  const escapeCell = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`
  const rows: string[] = [
    ['选项', '票数', '贡献金额(元)', '占比', '投票人数', '投票人明细'].map(escapeCell).join(','),
  ]
  const total = session.totalVotes || 0
  for (const opt of session.options ?? []) {
    const voters = getOptionVoters(opt)
    const pct = total > 0 ? `${((opt.count / total) * 100).toFixed(1)}%` : '0.0%'
    const voterText = voters
      .map((v) => `${v.name}${v.count > 1 ? `×${v.count}` : ''}${(v.contribution ?? 0) > 0 ? `(¥${v.contribution})` : ''}`)
      .join(' / ')
    rows.push(
      [opt.text, opt.count, opt.contribution ?? 0, pct, voters.length, voterText].map(escapeCell).join(','),
    )
  }

  const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vote-${session.id}-${session.title.replace(/[\\/:*?"<>|]/g, '_')}.csv`
  link.click()
  URL.revokeObjectURL(url)
  toast.success('已导出 CSV 投票明细')
}

function guardLabel(level?: number) {
  if (level === 1) return '总督'
  if (level === 2) return '提督'
  if (level === 3) return '舰长'
  return ''
}
</script>

<template>
  <Card class="border-border bg-card">
    <CardHeader class="pb-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <CardTitle class="text-sm font-semibold">投票历史与复盘</CardTitle>
        <div class="flex items-center gap-1.5">
          <div class="relative w-52">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              :model-value="keyword"
              placeholder="搜索投票标题..."
              class="pl-8"
              @update:model-value="(v) => emit('update:keyword', String(v))"
              @keyup.enter="emit('search')"
            />
          </div>
          <Button
            variant="outline"
            :disabled="loading"
            @click="emit('search')"
          >
            <RefreshCw class="size-3.5" :class="loading ? 'animate-spin' : ''" />
            查询
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-2.5">
      <Empty
        v-if="!loading && items.length === 0"
        description="暂无历史投票记录"
      />

      <div
        v-else
        class="space-y-2"
      >
        <div
          v-for="session in items"
          :key="session.id"
          class="rounded-lg border border-border p-3 transition-colors duration-150 hover:bg-muted/40"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-semibold text-sm truncate">{{ session.title }}</span>
                <Badge
                  v-if="session.isActive"
                  variant="secondary"
                  class="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  进行中
                </Badge>
                <Badge
                  v-else-if="getStandingsFor(session).leader"
                  variant="secondary"
                  class="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                >
                  <Dices v-if="session.winnerOverride" class="size-3" />
                  <Trophy v-else class="size-3" />
                  {{ session.winnerOverride ? '抽签胜出' : '胜出' }}：{{ getStandingsFor(session).leader?.text }}
                </Badge>
                <Badge
                  v-else-if="getStandingsFor(session).isTied"
                  variant="outline"
                  class="text-amber-600 dark:text-amber-400 border-amber-500/40"
                >
                  并列第一
                </Badge>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span>{{ formatTime(session.startTime) }}</span>
                <span>总票数 {{ session.totalVotes }}</span>
                <span v-if="(session.totalContribution ?? 0) > 0">
                  贡献 {{ formatContribution(session.totalContribution) }}
                </span>
                <span>{{ session.options.length }} 个选项</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1 shrink-0">
              <Popconfirm
                v-if="!session.isActive && !session.winnerOverride && getStandingsFor(session).isTied"
                @positive-click="emit('tiebreakDraw', session.id)"
              >
                <template #trigger>
                  <Button variant="secondary" size="xs">
                    <Dices class="size-3.5" />
                    补抽签
                  </Button>
                </template>
                在并列第一的选项中随机抽取胜出者并同步至 OBS 结算画面？
              </Popconfirm>

              <Button
                variant="ghost"
                size="xs"
                @click="detailSession = session"
              >
                <Eye class="size-3.5" />
                明细
              </Button>
              <Button
                variant="ghost"
                size="xs"
                @click="exportCsv(session)"
              >
                <Download class="size-3.5" />
                导出
              </Button>
              <Button
                variant="ghost"
                size="xs"
                @click="emit('reuse', session)"
              >
                <Copy class="size-3.5" />
                复刻
              </Button>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="删除记录"
                  >
                    <Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除该投票记录？</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定永久删除「{{ session.title }}」及其投票明细？此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction @click="emit('delete', session.id)">确认删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="pt-1 text-center">
        <Button
          variant="outline"
          :disabled="loading"
          @click="emit('loadMore')"
        >
          加载更多历史记录
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- 投票明细弹窗 -->
  <Dialog
    :open="!!detailSession"
    @update:open="(v) => { if (!v) detailSession = null }"
  >
    <DialogContent class="sm:max-w-xl">
      <DialogHeader v-if="detailSession">
        <DialogTitle class="flex items-center gap-2">
          <span class="truncate">{{ detailSession.title }}</span>
        </DialogTitle>
        <DialogDescription class="tabular-nums">
          {{ formatTime(detailSession.startTime) }} · 共 {{ detailSession.totalVotes }} 票
          <template v-if="(detailSession.totalContribution ?? 0) > 0">
            · 总贡献 {{ formatContribution(detailSession.totalContribution) }}
          </template>
          <template v-if="detailSession.winnerOverride">
            · 抽签胜出：{{ detailSession.winnerOverride }}
          </template>
        </DialogDescription>
      </DialogHeader>

      <ScrollArea
        v-if="detailSession"
        class="max-h-[60vh] pr-2 [&_[data-reka-scroll-area-viewport]>div]:!block"
      >
        <div class="space-y-3">
          <div
            v-for="(option, idx) in detailSession.options"
            :key="option.text"
            class="rounded-md border border-border p-3 space-y-2"
          >
            <div class="flex-between gap-2">
              <span class="text-xs font-semibold">
                {{ idx + 1 }}. {{ option.text }}
              </span>
              <span class="text-xs tabular-nums text-muted-foreground">
                <strong class="text-foreground">{{ option.count }}</strong> 票
                <template v-if="(option.contribution ?? 0) > 0">
                  · {{ formatContribution(option.contribution) }}
                </template>
                · {{ detailSession.totalVotes > 0 ? ((option.count / detailSession.totalVotes) * 100).toFixed(1) : '0.0' }}%
              </span>
            </div>

            <div
              v-if="getOptionVoters(option).length > 0"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="voter in getOptionVoters(option)"
                :key="voter.voterId"
                class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                <Crown
                  v-if="guardLabel(voter.guardLevel)"
                  class="size-2.5 text-amber-500"
                  :title="guardLabel(voter.guardLevel)"
                />
                <span>{{ voter.name }}</span>
                <span v-if="voter.count > 1" class="text-foreground/75 tabular-nums">×{{ voter.count }}</span>
                <span v-if="(voter.contribution ?? 0) > 0" class="text-amber-600 dark:text-amber-400 tabular-nums">
                  {{ formatContribution(voter.contribution) }}
                </span>
              </span>
            </div>
            <p v-else class="text-[11px] text-muted-foreground">暂无投票人记录</p>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
