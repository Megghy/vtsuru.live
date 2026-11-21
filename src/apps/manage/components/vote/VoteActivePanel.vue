<script setup lang="ts">
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Dices,
  GitMerge,
  Infinity as InfinityIcon,
  Pause,
  Play,
  Radio,
  Square,
  Timer,
  Trash2,
  Trophy,
  Users,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import {
  getMultiVoteModeLabel,
  getOptionVoters,
  type VoteConfigModel,
  type VoteOptionDtoModel,
  type VoteOptionWithVoters,
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
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import { formatContribution, getVoteStandings } from '@/shared/utils/voteStandings'

const props = defineProps<{
  session: VoteSessionModel
  config: VoteConfigModel
  nowMs: number
  busy: boolean
  channelStatus: { label: string; tone: 'online' | 'web' | 'offline' }
}>()

const emit = defineEmits<{
  extend: [seconds: number]
  pause: []
  resume: []
  end: [id: number]
  removeOption: [optionText: string]
  mergeOption: [sourceText: string, targetText: string]
  tiebreakDraw: [sessionId: number]
  tiebreakOvertime: [seconds: number]
}>()

const expandedOptions = ref<Record<string, boolean>>({})
const mergePopoverOpen = ref<Record<string, boolean>>({})
const VOTER_PREVIEW_LIMIT = 8

const optionDtos = computed<VoteOptionDtoModel[]>(() => {
  const totalVotes = props.session.totalVotes || 0
  const totalContribution = props.session.totalContribution || 0
  const useContrib = props.config.voteResultMode === VoteResultMode.ByContribution && totalContribution > 0
  return (props.session.options ?? []).map((opt, index) => ({
    index: index + 1,
    text: opt.text,
    count: opt.count,
    contribution: opt.contribution ?? 0,
    percentage: useContrib
      ? ((opt.contribution ?? 0) / totalContribution) * 100
      : totalVotes > 0
        ? (opt.count / totalVotes) * 100
        : 0,
  }))
})

const standings = computed(() =>
  getVoteStandings(optionDtos.value, props.config.voteResultMode, props.session.winnerOverride),
)

const timeLeftMs = computed(() => {
  if (props.session.isUnlimited) return null
  if (props.session.isPaused) {
    return props.session.pausedRemainingSeconds ? props.session.pausedRemainingSeconds * 1000 : null
  }
  return remainingMs(props.session.endTime, props.nowMs)
})

const isUrgent = computed(
  () => !props.session.isPaused && !props.session.isUnlimited && timeLeftMs.value !== null && timeLeftMs.value > 0 && timeLeftMs.value <= 10000,
)

function isLeader(optionText: string) {
  return standings.value.leaders.some((l) => l.text === optionText)
}

function getRatio(option: VoteOptionWithVoters) {
  if (standings.value.useContribution && standings.value.totalContribution > 0) {
    return (option.contribution ?? 0) / standings.value.totalContribution
  }
  return standings.value.total > 0 ? option.count / standings.value.total : 0
}

function getVisibleVoters(option: VoteOptionWithVoters) {
  const voters = getOptionVoters(option)
  return expandedOptions.value[option.text] ? voters : voters.slice(0, VOTER_PREVIEW_LIMIT)
}

function toggleVoters(text: string) {
  expandedOptions.value[text] = !expandedOptions.value[text]
}

function guardLabel(level?: number): string | null {
  if (level === 1) return '总督'
  if (level === 2) return '提督'
  if (level === 3) return '舰长'
  return null
}

function handleMerge(sourceText: string, targetText: string) {
  mergePopoverOpen.value[sourceText] = false
  emit('mergeOption', sourceText, targetText)
}
</script>

<template>
  <Card class="border-border bg-card">
    <CardHeader class="pb-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <Badge
              v-if="session.isPaused"
              variant="secondary"
              class="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
            >
              <Pause class="size-3" />
              已暂停
            </Badge>
            <Badge
              v-else
              variant="secondary"
              class="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            >
              <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              进行中
            </Badge>

            <Badge variant="outline" class="gap-1 tabular-nums">
              <template v-if="session.isUnlimited">
                <InfinityIcon class="size-3" />
                不限时
              </template>
              <template v-else-if="timeLeftMs !== null">
                <Clock
                  class="size-3"
                  :class="isUrgent ? 'text-destructive' : ''"
                />
                <span :class="isUrgent ? 'text-destructive font-semibold' : ''">
                  {{ session.isPaused ? `剩余 ${formatCountdown(timeLeftMs)}` : formatCountdown(timeLeftMs) }}
                </span>
              </template>
              <template v-else>进行中</template>
            </Badge>

            <Badge variant="outline">
              {{ getMultiVoteModeLabel(session.multiVoteMode, session.allowMultipleVotes) }}
            </Badge>

            <Badge
              variant="outline"
              class="gap-1"
              :class="
                channelStatus.tone === 'online'
                  ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : channelStatus.tone === 'web'
                    ? 'text-sky-600 dark:text-sky-400 border-sky-500/30'
                    : 'text-amber-600 dark:text-amber-400 border-amber-500/30'
              "
            >
              <Radio class="size-3" />
              {{ channelStatus.label }}
            </Badge>
          </div>

          <CardTitle class="text-base font-semibold leading-snug break-words">
            {{ session.title }}
          </CardTitle>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button
            v-if="session.isPaused"
            variant="secondary"
            :disabled="busy"
            @click="emit('resume')"
          >
            <Play class="size-3.5" />
            恢复
          </Button>
          <Button
            v-else
            variant="outline"
            :disabled="busy"
            @click="emit('pause')"
          >
            <Pause class="size-3.5" />
            暂停
          </Button>

          <Button
            v-for="sec in [30, 60, 120]"
            :key="sec"
            variant="outline"
            :disabled="busy"
            @click="emit('extend', sec)"
          >
            +{{ sec >= 120 ? `${sec / 60}m` : `${sec}s` }}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button
                variant="destructive"
                :disabled="busy"
              >
                <Square class="size-3.5" />
                结束投票
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认提前结束投票？</AlertDialogTitle>
                <AlertDialogDescription>
                  结束后将立即停止计票，并在 OBS 画面展示最终结算与胜出动效。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction @click="emit('end', session.id)">确认结束</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-3">
      <!-- 统计概览与平票破局提示 -->
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
        <div class="flex flex-wrap items-center gap-3 text-muted-foreground tabular-nums">
          <span>
            总票数 <strong class="text-foreground">{{ session.totalVotes }}</strong>
          </span>
          <span v-if="(session.totalContribution ?? 0) > 0">
            总贡献 <strong class="text-amber-600 dark:text-amber-400">{{ formatContribution(session.totalContribution) }}</strong>
          </span>
          <span>
            选项数 <strong class="text-foreground">{{ session.options.length }}</strong>
          </span>
          <span v-if="!config.showResults" class="text-amber-600 dark:text-amber-400">
            OBS 实时票数已隐藏（防从众）
          </span>
        </div>

        <div
          v-if="standings.isTied"
          class="flex flex-wrap items-center gap-1.5"
        >
          <span class="text-amber-600 dark:text-amber-400 font-medium">
            当前 {{ standings.leaders.length }} 项并列第一
          </span>
          <Popconfirm @positive-click="emit('tiebreakDraw', session.id)">
            <template #trigger>
              <Button
                variant="secondary"
                size="xs"
                :disabled="busy"
              >
                <Dices class="size-3.5" />
                抽签定胜负
              </Button>
            </template>
            立即在并列第一的选项中随机抽取胜出项并结算？
          </Popconfirm>
          <Popconfirm @positive-click="emit('tiebreakOvertime', 60)">
            <template #trigger>
              <Button
                variant="outline"
                size="xs"
                :disabled="busy"
              >
                <Timer class="size-3.5" />
                平票加时 60s
              </Button>
            </template>
            仅保留当前并列第一的选项，立即开启 60 秒决胜加时赛？
          </Popconfirm>
        </div>
      </div>

      <!-- 实时选项列表 -->
      <div class="space-y-2">
        <div
          v-for="(option, idx) in session.options"
          :key="option.text"
          class="rounded-lg border p-3 transition-colors duration-150"
          :class="isLeader(option.text) ? 'border-amber-500/45 bg-amber-500/5' : 'border-border bg-background/60'"
        >
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <div class="flex items-center gap-2 min-w-0">
              <span class="flex-center size-5 shrink-0 rounded bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                {{ idx + 1 }}
              </span>
              <span class="font-medium text-sm truncate" :title="option.text">
                {{ option.text }}
              </span>
              <Badge
                v-if="isLeader(option.text)"
                variant="secondary"
                class="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                <Trophy class="size-3" />
                {{ standings.isTied ? '并列领先' : '领先' }}
              </Badge>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right tabular-nums text-xs">
                <strong class="text-sm text-foreground">{{ option.count }}</strong>
                <span class="text-muted-foreground ml-0.5">票</span>
                <span
                  v-if="(option.contribution ?? 0) > 0"
                  class="ml-1.5 text-amber-600 dark:text-amber-400 font-medium"
                >
                  {{ formatContribution(option.contribution) }}
                </span>
                <span class="ml-1.5 text-muted-foreground">
                  {{ (getRatio(option) * 100).toFixed(1) }}%
                </span>
              </div>

              <!-- 选项管理（选项 > 2 时支持合并或删除恶意提名） -->
              <div
                v-if="session.options.length > 2"
                class="flex items-center gap-1"
              >
                <Popover v-model:open="mergePopoverOpen[option.text]">
                  <PopoverTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="合并到其他选项"
                      :disabled="busy"
                    >
                      <GitMerge class="size-3.5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-52 p-2" align="end">
                    <p class="px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
                      将「{{ option.text }}」并入：
                    </p>
                    <div class="mt-1 space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
                      <button
                        v-for="target in session.options.filter((o) => o.text !== option.text)"
                        :key="target.text"
                        type="button"
                        class="w-full rounded px-2 py-1.5 text-left text-xs list-item-interactive truncate"
                        @click="handleMerge(option.text, target.text)"
                      >
                        {{ target.text }}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popconfirm @positive-click="emit('removeOption', option.text)">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="移除该选项"
                      :disabled="busy"
                    >
                      <Trash2 class="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </template>
                  确定移除选项「{{ option.text }}」及其票数？
                </Popconfirm>
              </div>
            </div>
          </div>

          <!-- 进度条（GPU transform: scaleX） -->
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full w-full origin-left rounded-full transition-transform duration-300 ease-out"
              :class="isLeader(option.text) ? 'bg-amber-500' : 'bg-brand'"
              :style="{ transform: `scaleX(${getRatio(option)})` }"
            />
          </div>

          <!-- 投票人标签 -->
          <div
            v-if="getOptionVoters(option).length > 0"
            class="mt-2 flex flex-wrap items-center gap-1"
          >
            <Users class="size-3 text-muted-foreground mr-0.5 shrink-0" />
            <span
              v-for="voter in getVisibleVoters(option)"
              :key="voter.voterId"
              class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              <Crown
                v-if="guardLabel(voter.guardLevel)"
                class="size-2.5 text-amber-500"
                :title="guardLabel(voter.guardLevel)!"
              />
              <span>{{ voter.name }}</span>
              <span v-if="voter.count > 1" class="text-foreground/75 font-medium tabular-nums">×{{ voter.count }}</span>
              <span v-if="(voter.contribution ?? 0) > 0" class="text-amber-600 dark:text-amber-400 tabular-nums">
                {{ formatContribution(voter.contribution) }}
              </span>
            </span>
            <button
              v-if="getOptionVoters(option).length > VOTER_PREVIEW_LIMIT"
              type="button"
              class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-brand hover:underline"
              @click="toggleVoters(option.text)"
            >
              <template v-if="expandedOptions[option.text]">
                收起 <ChevronUp class="size-3" />
              </template>
              <template v-else>
                展开全部 {{ getOptionVoters(option).length }} 人 <ChevronDown class="size-3" />
              </template>
            </button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
