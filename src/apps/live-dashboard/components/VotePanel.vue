<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import { useIntervalFn, useNow } from '@vueuse/core'
import { Dices, ExternalLink, Pause, Play, Square, Timer } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { VOTE_MULTI_MODE_OPTIONS, VoteMultiMode } from '@/api/vote'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import {
  mergeCloudAndLocalTemplates,
  useVoteTemplates,
  VOTE_QUICK_PRESETS,
  type VotePreset,
} from '@/shared/utils/votePresets'
import { formatContribution, voteOutcomeLabel } from '@/shared/utils/voteStandings'

import { useDashboardVote } from '../store/vote'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const { session, config, loaded, busy, pollError, options, standings, ...vote } = useDashboardVote()
const localTemplates = useVoteTemplates()
const presets = computed<VotePreset[]>(() => [
  ...VOTE_QUICK_PRESETS,
  ...mergeCloudAndLocalTemplates(config.value.templates, localTemplates.value),
])
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })

const active = computed(() => !!session.value?.isActive)
const paused = computed(() => !!session.value?.isPaused)
const timeLeft = computed(() => {
  if (!session.value || session.value.isUnlimited) return null
  if (session.value.isPaused) {
    return session.value.pausedRemainingSeconds ? session.value.pausedRemainingSeconds * 1000 : null
  }
  return remainingMs(session.value.endTime, now.value.getTime())
})
const outcome = computed(() =>
  voteOutcomeLabel(standings.value, !active.value, {
    isPaused: paused.value,
    winnerByDraw: !!session.value?.winnerOverride,
  }),
)

const title = ref('')
const optionsText = ref('')
const duration = ref(60)
const multiVoteMode = ref<VoteMultiMode>(VoteMultiMode.Single)

watch(
  () => [config.value.voteDurationSeconds, config.value.multiVoteMode] as const,
  ([cfgDuration, cfgMode]) => {
    if (!title.value && !optionsText.value) {
      duration.value = cfgDuration ?? 60
      multiVoteMode.value = cfgMode ?? VoteMultiMode.Single
    }
  },
  { immediate: true },
)

const draftOptions = computed(() =>
  optionsText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

function applyPreset(preset: VotePreset) {
  title.value = preset.title
  optionsText.value = preset.options.join('\n')
  if (preset.durationSeconds !== undefined) duration.value = preset.durationSeconds
  if (preset.multiVoteMode !== undefined) multiVoteMode.value = preset.multiVoteMode
}

function reuse() {
  if (!session.value) return
  applyPreset({
    name: '',
    title: session.value.title,
    options: session.value.options.map((o) => o.text),
    multiVoteMode: session.value.multiVoteMode,
  })
}

function create() {
  void vote.create({
    title: title.value.trim(),
    options: draftOptions.value,
    multiVoteMode: multiVoteMode.value,
    durationSeconds: duration.value > 0 ? duration.value : null,
  })
}

function openManage() {
  const url = `${CURRENT_HOST}manage/vote`
  if (isTauri()) void openUrl(url)
  else window.open(url, '_blank')
}
</script>

<template>
  <PanelShell
    title="投票"
    :blurred="blurred"
  >
    <template #actions>
      <Tag
        v-if="pollError"
        variant="destructive"
        class="text-xs"
        :title="pollError"
      >
        同步失败
      </Tag>
      <IconAction
        :icon="ExternalLink"
        tip="打开投票管理（OBS 链接、全局设置、历史）"
        @click="openManage"
      />
    </template>
    <div class="grid content-start gap-3 box-border h-full p-2.5 overflow-y-auto scrollbar-thin text-[13px]">
      <section
        v-if="session"
        class="grid gap-1.5"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            v-if="active"
            class="size-2 shrink-0 rounded-full"
            :class="paused ? 'bg-amber-500' : 'vote__live bg-[var(--vtsuru-success)]'"
          />
          <span class="font-semibold truncate">{{ session.title }}</span>
          <span class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            <template v-if="active">
              <template v-if="paused">已暂停</template>
              <template v-else-if="session.isUnlimited || timeLeft === null">不限时</template>
              <template v-else>{{ formatCountdown(timeLeft) }}</template>
            </template>
            <template v-else>已结束</template>
            · {{ session.totalVotes }} 票
            <template v-if="(session.totalContribution ?? 0) > 0">
              · {{ formatContribution(session.totalContribution) }}
            </template>
          </span>
        </div>
        <div
          v-for="option in options"
          :key="option.index"
          class="vote__option"
          :class="{ 'vote__option--lead': standings.leaders.some((l) => l.index === option.index) }"
        >
          <div
            class="vote__bar"
            :style="{ transform: `scaleX(${Math.max(0, Math.min(100, option.percentage)) / 100})` }"
          />
          <span class="vote__index">{{ option.index }}</span>
          <span class="vote__text">{{ option.text }}</span>
          <span class="vote__count">
            <template v-if="standings.useContribution">
              {{ formatContribution(option.contribution) }} · {{ option.count }}票
            </template>
            <template v-else>
              {{ option.count }} · {{ Math.round(option.percentage) }}%
            </template>
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-auto text-xs text-muted-foreground">{{ outcome }}</span>
          <template v-if="active">
            <Button
              v-if="paused"
              size="xs"
              variant="secondary"
              :disabled="busy"
              @click="vote.resumeVote()"
            >
              <Play class="size-3" />
              恢复
            </Button>
            <Button
              v-else
              size="xs"
              variant="outline"
              :disabled="busy"
              @click="vote.pauseVote()"
            >
              <Pause class="size-3" />
              暂停
            </Button>
            <Button
              v-for="seconds in [30, 60]"
              :key="seconds"
              size="xs"
              variant="secondary"
              :disabled="busy"
              @click="vote.extend(seconds)"
            >
              +{{ seconds }}s
            </Button>
            <Popconfirm @positive-click="vote.end(session.id)">
              <template #trigger>
                <Button
                  size="xs"
                  variant="outline"
                  class="text-amber-500 border-amber-500 hover:bg-amber-500/10"
                  :disabled="busy"
                >
                  <Square class="size-3" />
                  结束
                </Button>
              </template>
              提前结束并展示结果？
            </Popconfirm>
          </template>
          <template v-else>
            <Popconfirm
              v-if="standings.isTied && !session.winnerOverride"
              @positive-click="vote.tiebreakDraw(session.id)"
            >
              <template #trigger>
                <Button
                  size="xs"
                  variant="secondary"
                  :disabled="busy"
                >
                  <Dices class="size-3" />
                  抽签
                </Button>
              </template>
              随机抽取并列第一中的胜出项？
            </Popconfirm>
            <Popconfirm
              v-if="standings.isTied"
              @positive-click="vote.tiebreakOvertime(60)"
            >
              <template #trigger>
                <Button
                  size="xs"
                  variant="outline"
                  :disabled="busy"
                >
                  <Timer class="size-3" />
                  加时赛
                </Button>
              </template>
              仅保留并列项开启 60s 决胜加时？
            </Popconfirm>
            <Button
              size="xs"
              variant="secondary"
              @click="reuse"
            >
              复用选项
            </Button>
          </template>
        </div>

        <!-- 进行中平票破局快捷条 -->
        <div
          v-if="active && standings.isTied"
          class="flex items-center gap-1.5 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs"
        >
          <span class="mr-auto text-amber-600 dark:text-amber-400">当前平票</span>
          <Popconfirm @positive-click="vote.tiebreakDraw(session.id)">
            <template #trigger>
              <Button size="xs" variant="secondary" :disabled="busy">
                <Dices class="size-3" />抽签结算
              </Button>
            </template>
            随机抽签并立即结算投票？
          </Popconfirm>
          <Popconfirm @positive-click="vote.tiebreakOvertime(60)">
            <template #trigger>
              <Button size="xs" variant="outline" :disabled="busy">
                <Timer class="size-3" />加时 60s
              </Button>
            </template>
            仅保留平票选项开启 60s 加时赛？
          </Popconfirm>
        </div>
      </section>

      <section
        v-if="!active && loaded"
        class="grid gap-1.5"
      >
        <div class="vote__presets flex flex-wrap gap-1">
          <Button
            v-for="(preset, index) in presets"
            :key="preset.id ?? index"
            size="xs"
            variant="ghost"
            class="text-muted-foreground"
            @click="applyPreset(preset)"
          >
            {{ preset.name }}
          </Button>
        </div>
        <Input
          v-model="title"
          placeholder="投票标题"
          maxlength="50"
        />
        <Textarea
          v-model="optionsText"
          class="min-h-[64px]"
          placeholder="每行一个选项，观众发送序号或选项文字投票"
        />
        <div class="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-1.5">
          <div class="flex items-center gap-1">
            <NumberField
              v-model="duration"
              :min="0"
              :step="30"
              class="w-full"
            />
            <span class="text-xs text-muted-foreground shrink-0">秒</span>
          </div>
          <Select
            :model-value="String(multiVoteMode)"
            @update:model-value="(v) => { multiVoteMode = Number(v) as VoteMultiMode }"
          >
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in VOTE_MULTI_MODE_OPTIONS"
                :key="opt.value"
                :value="String(opt.value)"
              >
                {{ opt.shortLabel }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            :disabled="busy || !title.trim() || draftOptions.length < 2"
            @click="create"
          >
            发起
          </Button>
        </div>
        <div class="text-xs text-muted-foreground">时长为 0 表示不限时</div>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.vote__live {
  animation: pulse 1.6s ease-in-out infinite;
}
.vote__option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.vote__bar {
  position: absolute;
  inset: 0;
  background: var(--muted);
  transform-origin: left;
  transition: transform 0.4s ease;
}

.vote__option--lead .vote__bar {
  background: color-mix(in srgb, var(--primary) 22%, transparent);
}

.vote__index,
.vote__text,
.vote__count {
  position: relative;
}

.vote__index {
  font-size: 11px;
  color: var(--muted-foreground);
}

.vote__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote__count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
