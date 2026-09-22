<script setup lang="ts">
import { Clock24Regular, Ribbon24Filled, Trophy24Filled } from '@vicons/fluent'
import { computed } from 'vue'

import type { VoteOBSData, VoteOptionDto } from '@/api/api-models'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import { useVoteCardMotion } from '@/shared/utils/voteCardMotion'
import { getVoteStandings, voteOutcomeLabel } from '@/shared/utils/voteStandings'

import VoteDuelComparison from './VoteDuelComparison.vue'

const props = withDefaults(
  defineProps<{
    data: VoteOBSData | null
    theme?: string
    position?: string
    maxDisplay?: number
    currentTimeMs?: number
  }>(),
  { position: 'center', maxDisplay: 6, currentTimeMs: () => Date.now() },
)

const activeTheme = computed(() =>
  props.theme && ['glass', 'duel', 'minimal', 'transparent'].includes(props.theme)
    ? props.theme
    : props.data?.theme || 'glass',
)
const timeLeftMs = computed(() => remainingMs(props.data?.endTime, props.currentTimeMs))
const isUrgent = computed(
  () => props.data?.isActive && timeLeftMs.value !== null && timeLeftMs.value > 0 && timeLeftMs.value <= 10000,
)
const standings = computed(() => getVoteStandings(props.data?.options ?? []))
// OBS 接口按票数排序返回；对决左右必须按原始选项编号固定，不能随领先者换边。
const originalOptions = computed(() => (props.data?.options ?? []).toSorted((a, b) => a.index - b.index))
const duel = computed(() =>
  activeTheme.value === 'duel' && originalOptions.value.length === 2
    ? { left: originalOptions.value[0], right: originalOptions.value[1] }
    : null,
)
const isBanner = computed(() => duel.value !== null && props.position.startsWith('top'))
const orderedOptions = computed(() => (props.data?.showResults ? standings.value.ordered : originalOptions.value))
const displayedOptions = computed(() => orderedOptions.value.slice(0, props.maxDisplay))
const hiddenOptions = computed(() => orderedOptions.value.slice(props.maxDisplay))
const hiddenVotes = computed(() => hiddenOptions.value.reduce((sum, option) => sum + option.count, 0))
const outcome = computed(() => voteOutcomeLabel(standings.value, props.data?.isEnding ?? false))
const { moves, overtaking } = useVoteCardMotion(() => props.data)

function isTop(option: VoteOptionDto) {
  return props.data?.showResults && standings.value.leaders.some((leader) => leader.index === option.index)
}
function isWinner(option: VoteOptionDto) {
  return props.data?.showResults && props.data.isEnding && standings.value.leader?.index === option.index
}
function ratio(option: VoteOptionDto) {
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
            'rounded-box': data.roundedCorners,
          },
        ]"
      >
        <header class="vote-header">
          <div class="header-left">
            <span
              class="status-indicator"
              :class="{ ending: data.isEnding }"
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
              v-else-if="timeLeftMs !== null"
              class="badge-timer"
              :class="{ urgent: isUrgent }"
            >
              <Clock24Regular class="vote-icon" />{{ formatCountdown(timeLeftMs) }}
            </span>
          </div>
        </header>

        <div class="vote-sub-stats">
          <span
            >总投票
            <strong
              ><span
                :key="data.totalVotes"
                class="vote-number"
                >{{ data.totalVotes }}</span
              ></strong
            >
            票</span
          >
          <span
            v-if="!data.showResults"
            class="vote-outcome"
            >结果未公开</span
          >
          <span
            v-else-if="!duel"
            class="vote-outcome"
            role="status"
          >
            <Trophy24Filled
              v-if="data.isEnding && standings.leader"
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
          :show-results="data.showResults"
          :is-ending="data.isEnding"
          :overtaking="overtaking"
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
                'is-dimmed': data.showResults && data.isEnding && standings.leader && !isWinner(option),
                'is-overtaking': data.showResults && moves[option.index] === 'up',
              }"
            >
              <div
                v-if="data.showResults"
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
                    <Ribbon24Filled class="vote-icon" />胜出
                  </span>
                  <span
                    v-else-if="isTop(option)"
                    class="leading-badge"
                  >
                    {{ standings.leaders.length > 1 ? '并列第一' : overtaking === option.index ? '反超' : '领先' }}
                  </span>
                </div>
                <div
                  v-if="data.showResults"
                  class="option-right"
                >
                  <strong class="option-count"
                    ><span
                      :key="option.count"
                      class="vote-number"
                      >{{ option.count }}</span
                    >
                    <small>票</small></strong
                  >
                  <span class="option-percentage">{{ (ratio(option) * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </TransitionGroup>
          <div
            v-if="hiddenOptions.length > 0"
            class="remaining-hint"
          >
            另有 {{ hiddenOptions.length }} 个候选项<span v-if="data.showResults">（共 {{ hiddenVotes }} 票）</span>
          </div>
        </div>

        <div
          v-if="data.showResults && data.isEnding && standings.leader"
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
