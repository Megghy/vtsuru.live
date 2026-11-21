<script setup lang="ts">
import { Award, Clock, Dices, Infinity as InfinityIcon, Pause, Sparkles, Trophy } from 'lucide-vue-next'
import { computed } from 'vue'

import { type VoteOBSDataModel, type VoteOptionDtoModel, VoteResultMode } from '@/api/vote'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import { useVoteCardMotion } from '@/shared/utils/voteCardMotion'
import { formatContribution, getVoteStandings, voteOutcomeLabel } from '@/shared/utils/voteStandings'

import VoteDuelComparison from './VoteDuelComparison.vue'

const SUPPORTED_THEMES = ['glass', 'duel', 'minimal', 'transparent', 'light'] as const

const props = withDefaults(
  defineProps<{
    data: VoteOBSDataModel | null
    theme?: string
    position?: string
    layout?: 'auto' | 'card' | 'banner'
    maxDisplay?: number
    currentTimeMs?: number
    borderRadiusOverride?: number
    fontFamilyOverride?: string
    showResultsOverride?: boolean | null
    disableShadow?: boolean
  }>(),
  {
    position: 'center',
    layout: 'auto',
    maxDisplay: 6,
    currentTimeMs: () => Date.now(),
    showResultsOverride: null,
  },
)

const activeTheme = computed(() =>
  props.theme && (SUPPORTED_THEMES as readonly string[]).includes(props.theme)
    ? props.theme
    : props.data?.theme && (SUPPORTED_THEMES as readonly string[]).includes(props.data.theme)
      ? props.data.theme
      : 'glass',
)

const effectiveFontFamily = computed(() => props.fontFamilyOverride?.trim() || props.data?.fontFamily?.trim() || '')
useGoogleFont(effectiveFontFamily)

const effectiveShowResults = computed(() => {
  if (props.data?.isEnding) return true
  if (typeof props.showResultsOverride === 'boolean') return props.showResultsOverride
  return props.data?.showResults ?? true
})

const effectiveResultMode = computed(() => props.data?.resultMode ?? VoteResultMode.ByCount)

const cardStyle = computed(() => {
  const style: Record<string, string> = {}
  const d = props.data
  if (effectiveFontFamily.value) {
    style['--vote-font-family'] = resolveFontFamilyCss(effectiveFontFamily.value)
  }
  if (d?.fontScale && d.fontScale !== 1) {
    style['--vote-font-scale'] = String(Math.max(0.75, Math.min(1.5, d.fontScale)))
  }
  if (typeof props.borderRadiusOverride === 'number') {
    style['--vote-radius'] = `${Math.max(0, props.borderRadiusOverride)}px`
  } else if (d) {
    const r = d.roundedCorners === false ? 0 : (d.borderRadius ?? 20)
    style['--vote-radius'] = `${Math.max(0, r)}px`
  }
  if (typeof d?.cardOpacity === 'number' && d.cardOpacity > 0) {
    style['--vote-card-opacity'] = String(Math.max(0.1, Math.min(1, d.cardOpacity)))
  }
  if (typeof d?.backdropBlur === 'number' && d.backdropBlur >= 0) {
    style['--vote-backdrop-blur'] = `${Math.max(0, Math.min(40, d.backdropBlur))}px`
  }
  if (d?.accentColor?.trim()) style['--vote-accent'] = d.accentColor.trim()
  if (d?.leadingColor?.trim()) style['--vote-leading'] = d.leadingColor.trim()
  return style
})

const timeLeftMs = computed(() =>
  props.data?.isUnlimited || props.data?.isPaused ? null : remainingMs(props.data?.endTime, props.currentTimeMs),
)
const isUrgent = computed(
  () =>
    !!props.data?.isActive &&
    !props.data?.isPaused &&
    !props.data?.isUnlimited &&
    timeLeftMs.value !== null &&
    timeLeftMs.value > 0 &&
    timeLeftMs.value <= 10000,
)

const standings = computed(() =>
  getVoteStandings(
    props.data?.options ?? [],
    effectiveResultMode.value,
    props.data?.winnerByDraw ? props.data.winnerOption : null,
  ),
)

// OBS 接口按票数/贡献排序返回；对决左右必须按原始选项编号固定，不能随领先者换边。
const originalOptions = computed(() => (props.data?.options ?? []).toSorted((a, b) => a.index - b.index))
const duel = computed(() =>
  activeTheme.value === 'duel' && originalOptions.value.length === 2
    ? { left: originalOptions.value[0], right: originalOptions.value[1] }
    : null,
)
const isBanner = computed(() => {
  if (!duel.value) return false
  if (props.layout === 'banner') return true
  if (props.layout === 'card') return false
  return props.position.startsWith('top')
})

const orderedOptions = computed(() => (effectiveShowResults.value ? standings.value.ordered : originalOptions.value))
const displayedOptions = computed(() => orderedOptions.value.slice(0, props.maxDisplay))
const hiddenOptions = computed(() => orderedOptions.value.slice(props.maxDisplay))
const hiddenVotes = computed(() => hiddenOptions.value.reduce((sum, option) => sum + option.count, 0))
const outcome = computed(() =>
  voteOutcomeLabel(standings.value, props.data?.isEnding ?? false, {
    isPaused: props.data?.isPaused,
    winnerByDraw: props.data?.winnerByDraw,
  }),
)
const { moves, overtaking } = useVoteCardMotion(() => props.data)

function isTop(option: VoteOptionDtoModel) {
  return effectiveShowResults.value && standings.value.leaders.some((leader) => leader.index === option.index)
}
function isWinner(option: VoteOptionDtoModel) {
  return effectiveShowResults.value && !!props.data?.isEnding && standings.value.leader?.index === option.index
}
function ratio(option: VoteOptionDtoModel) {
  if (standings.value.useContribution && standings.value.totalContribution > 0) {
    return (option.contribution ?? 0) / standings.value.totalContribution
  }
  return standings.value.total > 0 ? option.count / standings.value.total : 0
}

const confettiColors = ['#fbbf24', '#38bdf8', '#f472b6', '#34d399']
const confetti = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37 + 6) % 100}%`,
  animationDelay: `${(index % 5) * 90}ms`,
  animationDuration: `${1100 + (index % 4) * 160}ms`,
  background: confettiColors[index % confettiColors.length],
}))
</script>

<template>
  <div
    class="danmaku-vote-card-root"
    :class="`pos-${position}`"
    :style="cardStyle"
  >
    <Transition
      name="vote-pop"
      mode="out-in"
    >
      <section
        v-if="data"
        :key="data.sessionId"
        class="danmaku-vote-card"
        :class="[
          `theme-${activeTheme}`,
          {
            'duel-top-banner': isBanner,
            'is-urgent': isUrgent,
            'is-ended': data.isEnding,
            'no-shadow': disableShadow,
          },
        ]"
      >
        <header class="vote-header">
          <div class="header-left">
            <span
              class="status-indicator"
              :class="{ ending: data.isEnding, paused: data.isPaused && !data.isEnding }"
            ></span>
            <h1
              class="vote-title"
              :title="data.title"
            >
              {{ data.title }}
            </h1>
          </div>
          <div class="header-right">
            <span
              v-if="data.isEnding"
              class="badge-ended"
              >已结算</span
            >
            <span
              v-else-if="data.isPaused"
              class="badge-paused"
            >
              <Pause class="vote-icon" />已暂停
            </span>
            <span
              v-else-if="data.isUnlimited"
              class="badge-unlimited"
            >
              <InfinityIcon class="vote-icon" />不限时
            </span>
            <span
              v-else-if="timeLeftMs !== null"
              class="badge-timer"
              :class="{ urgent: isUrgent }"
            >
              <Clock class="vote-icon" />{{ formatCountdown(timeLeftMs) }}
            </span>
          </div>
        </header>

        <div class="vote-sub-stats">
          <span class="sub-stats-left">
            <span>
              总投票
              <strong>
                <span
                  :key="data.totalVotes"
                  class="vote-number"
                  >{{ data.totalVotes }}</span
                >
              </strong>
              票
            </span>
            <span
              v-if="effectiveShowResults && standings.totalContribution > 0"
              class="sub-contribution"
            >
              {{ formatContribution(standings.totalContribution) }}
            </span>
          </span>
          <span
            v-if="!effectiveShowResults"
            class="vote-outcome"
            >结果未公开</span
          >
          <span
            v-else-if="!duel"
            class="vote-outcome"
            role="status"
          >
            <Dices
              v-if="data.isEnding && (data.winnerByDraw || standings.hasOverrideWinner)"
              class="vote-icon"
            />
            <Trophy
              v-else-if="data.isEnding && standings.leader"
              class="vote-icon"
            />
            {{ outcome }}
          </span>
        </div>

        <VoteDuelComparison
          v-if="duel"
          :banner="isBanner"
          :left="duel.left"
          :right="duel.right"
          :standings="standings"
          :show-results="effectiveShowResults"
          :is-ending="data.isEnding"
          :is-paused="data.isPaused"
          :winner-by-draw="data.winnerByDraw"
          :overtaking="overtaking"
          :left-color="data.duelLeftColor"
          :right-color="data.duelRightColor"
        />
        <div
          v-else
          class="options-list-wrapper"
        >
          <TransitionGroup
            name="flip-list"
            tag="div"
            class="options-list"
          >
            <div
              v-for="option in displayedOptions"
              :key="option.index"
              class="option-row"
              :data-option-index="option.index"
              :class="{
                'is-leading': isTop(option) && !data.isEnding,
                'is-winner': isWinner(option),
                'is-dimmed': effectiveShowResults && data.isEnding && standings.leader && !isWinner(option),
                'is-overtaking': effectiveShowResults && moves[option.index] === 'up',
              }"
            >
              <div
                v-if="effectiveShowResults"
                class="option-progress-bg"
                :style="{ transform: `scaleX(${ratio(option)})` }"
                aria-hidden="true"
              ></div>
              <div class="option-content">
                <div class="option-left">
                  <span class="option-num">{{ option.index }}.</span>
                  <span
                    class="option-text"
                    :title="option.text"
                    >{{ option.text }}</span
                  >
                  <span
                    v-if="isWinner(option)"
                    class="leading-badge"
                  >
                    <Dices
                      v-if="data.winnerByDraw || standings.hasOverrideWinner"
                      class="vote-icon"
                    />
                    <Award
                      v-else
                      class="vote-icon"
                    />
                    {{ data.winnerByDraw || standings.hasOverrideWinner ? '抽签胜出' : '胜出' }}
                  </span>
                  <span
                    v-else-if="isTop(option)"
                    class="leading-badge"
                  >
                    {{ standings.leaders.length > 1 ? '并列第一' : overtaking === option.index ? '反超' : '领先' }}
                  </span>
                </div>
                <div
                  v-if="effectiveShowResults"
                  class="option-right"
                >
                  <template v-if="standings.useContribution">
                    <strong class="option-count">
                      <span
                        :key="option.contribution"
                        class="vote-number"
                        >{{ formatContribution(option.contribution) }}</span
                      >
                    </strong>
                    <span class="option-sub-metric">{{ option.count }}票</span>
                  </template>
                  <strong
                    v-else
                    class="option-count"
                  >
                    <span
                      :key="option.count"
                      class="vote-number"
                      >{{ option.count }}</span
                    >
                    <small>票</small>
                  </strong>
                  <span class="option-percentage">{{ (ratio(option) * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </TransitionGroup>
          <div
            v-if="hiddenOptions.length > 0"
            class="remaining-hint"
          >
            另有 {{ hiddenOptions.length }} 个候选项<span v-if="effectiveShowResults">（共 {{ hiddenVotes }} 票）</span>
          </div>
        </div>

        <div
          v-if="data.showRecentVoter !== false && !data.isEnding && data.recentVoterName"
          class="recent-voter-bar"
        >
          <Sparkles class="vote-icon shrink-0" />
          <span class="recent-voter-text">
            <strong>{{ data.recentVoterName }}</strong>
            <template v-if="effectiveShowResults && data.recentVoterOption">
              投给了「{{ data.recentVoterOption }}」
            </template>
            <template v-else> 刚刚投了一票 </template>
          </span>
        </div>

        <div
          v-if="effectiveShowResults && data.isEnding && standings.leader"
          class="reveal-layer"
          aria-hidden="true"
        >
          <span
            v-for="(style, index) in confetti"
            :key="index"
            class="confetti"
            :style="style"
          ></span>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped src="./voteCardLayout.css"></style>
<style scoped src="./voteCardThemes.css"></style>
<style src="./voteCardMotion.css"></style>
