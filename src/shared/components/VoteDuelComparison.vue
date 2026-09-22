<script setup lang="ts">
import { ArrowLeft24Filled, ArrowRight24Filled, Ribbon24Filled } from '@vicons/fluent'
import { computed } from 'vue'

import type { VoteOptionDto } from '@/api/api-models'
import type { VoteStandings } from '@/shared/utils/voteStandings'

const props = defineProps<{
  banner: boolean
  left: VoteOptionDto
  right: VoteOptionDto
  standings: VoteStandings
  showResults: boolean
  isEnding: boolean
  overtaking: number | null
}>()

const sides = computed(() => [props.left, props.right])
const leftRatio = computed(() => (props.standings.total > 0 ? props.left.count / props.standings.total : 0.5))
const leaderSide = computed(() => {
  if (!props.showResults || !props.standings.leader) return null
  return props.standings.leader.index === props.left.index ? 'left' : 'right'
})
const statusLabel = computed(() => {
  if (!props.showResults) return '结果未公开'
  if (!props.standings.total) return props.isEnding ? '无人投票' : '等待投票'
  if (!leaderSide.value) return props.isEnding ? '平票结束' : '平票'
  return `${props.isEnding ? '胜出' : '领先'} ${props.standings.gap} 票`
})
const statusDetail = computed(() =>
  leaderSide.value ? `${props.standings.leader!.text}，${statusLabel.value}` : statusLabel.value,
)

function isLeader(option: VoteOptionDto) {
  return props.showResults && props.standings.leader?.index === option.index
}
function percent(option: VoteOptionDto) {
  return props.standings.total > 0 ? `${((option.count / props.standings.total) * 100).toFixed(1)}%` : '0.0%'
}
</script>

<template>
  <section
    class="duel-comparison"
    :class="{ 'is-banner': banner }"
  >
    <div class="duel-scoreboard">
      <div
        v-for="(option, index) in sides"
        :key="option.index"
        class="duel-side"
        :class="[
          index === 0 ? 'side-left' : 'side-right',
          {
            'is-leading': isLeader(option),
            'is-overtaking': showResults && !isEnding && overtaking === option.index,
            'is-winner': isEnding && isLeader(option),
          },
        ]"
        :data-option-index="option.index"
      >
        <div class="duel-name-row">
          <span class="duel-index">{{ option.index }}.</span>
          <span
            class="duel-name"
            :title="option.text"
            >{{ option.text }}</span
          >
          <span
            v-if="isLeader(option)"
            class="duel-leader-badge"
          >
            <Ribbon24Filled
              v-if="isEnding"
              class="vote-icon"
            />{{ isEnding ? '胜出' : '领先' }}
          </span>
        </div>
        <div
          v-if="showResults"
          class="duel-stats"
        >
          <span class="duel-votes"
            ><span
              :key="option.count"
              class="vote-number"
              >{{ option.count }}</span
            ><small>票</small></span
          >
          <span class="duel-percent">{{ percent(option) }}</span>
        </div>
      </div>
      <div
        class="duel-status"
        :class="leaderSide"
        role="status"
        :aria-label="statusDetail"
      >
        <div class="duel-status-label">
          <ArrowLeft24Filled
            v-if="leaderSide === 'left'"
            class="vote-icon direction-icon"
          />
          <strong>{{ statusLabel }}</strong>
          <ArrowRight24Filled
            v-if="leaderSide === 'right'"
            class="vote-icon direction-icon"
          />
        </div>
        <Transition
          name="overtake"
          :css="!isEnding"
        >
          <span
            v-if="showResults && !isEnding && overtaking !== null"
            class="duel-overtake"
            >反超</span
          >
        </Transition>
      </div>
    </div>
    <div
      v-if="showResults"
      class="duel-track-wrap"
    >
      <!-- 中线固定在 50%，分界与填充使用未舍入的真实比例。零票仅显示中性轨道。 -->
      <div
        class="duel-track"
        :class="{ 'has-votes': standings.total > 0 }"
        aria-hidden="true"
      >
        <div
          class="duel-fill side-left"
          :style="{ transform: `scaleX(${leftRatio})` }"
        ></div>
        <div
          class="duel-fill side-right"
          :style="{ transform: `scaleX(${1 - leftRatio})` }"
        ></div>
      </div>
      <span
        class="duel-midline"
        title="50% 中线"
        aria-hidden="true"
      ></span>
    </div>
  </section>
</template>

<style scoped>
.duel-comparison {
  --vote-left: #93c5fd;
  --vote-right: #fca5a5;
  display: grid;
  gap: 12px;
}
.duel-scoreboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-areas: 'left status right';
  align-items: center;
  gap: 12px;
}
.duel-side {
  --side-color: var(--vote-left);
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgb(255 255 255 / 3%);
}
.side-left {
  grid-area: left;
}
.side-right {
  --side-color: var(--vote-right);
  grid-area: right;
  text-align: right;
}
.duel-side.is-leading {
  border-color: var(--side-color);
  background: color-mix(in srgb, var(--side-color) 13%, transparent);
}
.duel-side.is-winner {
  border-color: #fcd34d;
}
.duel-name-row,
.duel-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.side-right .duel-name-row,
.side-right .duel-stats {
  justify-content: flex-end;
}
.duel-index {
  font-size: 12px;
  color: var(--side-color);
}
.duel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 650;
}
.duel-leader-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 2px;
  border-radius: 4px;
  padding: 2px 5px;
  color: #101827;
  background: var(--side-color);
  font-size: 10px;
  font-weight: 800;
}
.is-winner .duel-leader-badge {
  background: #fcd34d;
}
.duel-votes {
  font-size: 24px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.duel-votes small {
  font-size: 11px;
  font-weight: 500;
  margin-left: 4px;
}
.is-leading .duel-votes {
  color: var(--side-color);
  font-weight: 850;
}
.duel-percent {
  font-size: 12px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}
.duel-stats {
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
}
.duel-status {
  grid-area: status;
  position: relative;
  text-align: center;
  color: #cbd5e1;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.duel-status.left {
  color: var(--vote-left);
}
.duel-status.right {
  color: var(--vote-right);
}
.duel-status-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}
.vote-icon {
  width: 13px;
  height: 13px;
  flex: none;
}
.direction-icon {
  width: 18px;
  height: 18px;
}
.duel-overtake {
  position: absolute;
  top: calc(100% + 3px);
  left: 50%;
  translate: -50% 0;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.duel-track-wrap {
  position: relative;
  padding: 3px 0;
}
.duel-track {
  position: relative;
  height: 14px;
  border-radius: 4px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
}
.duel-fill {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: transform 420ms ease-out;
}
.has-votes .duel-fill {
  opacity: 1;
}
.duel-fill.side-left {
  background: #60a5fa;
  transform-origin: left;
}
.duel-fill.side-right {
  background: #f87171;
  transform-origin: right;
}
.duel-midline {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  translate: -50% 0;
  background: #f8fafc;
  box-shadow: 0 0 0 1px rgb(15 23 42 / 80%);
}
.overtake-enter-active,
.overtake-leave-active {
  transition:
    opacity 180ms,
    transform 180ms;
}
.overtake-enter-from,
.overtake-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
@container vote-card (min-width: 521px) {
  .is-banner .duel-side {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .is-banner .duel-name-row {
    flex: 1;
  }
  .is-banner .duel-stats {
    flex: none;
    flex-wrap: nowrap;
    gap: 8px;
  }
  .is-banner .side-right .duel-name-row {
    order: 1;
  }
  .is-banner .duel-votes {
    font-size: 22px;
  }
  .is-banner .duel-percent {
    font-size: 11px;
  }
}
@container vote-card (max-width: 520px) {
  .duel-side {
    grid-template-rows: 1fr auto;
    align-self: stretch;
  }
  .duel-name-row {
    align-self: start;
  }
  .duel-stats {
    display: grid;
    gap: 2px;
  }

  .duel-scoreboard {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas: 'left right' 'status status';
    gap: 8px;
  }
  .duel-side {
    padding: 8px;
  }
  .duel-name-row {
    flex-wrap: wrap;
    gap: 4px;
  }
  .duel-name {
    max-width: calc(100% - 24px);
  }
  .duel-votes {
    font-size: 21px;
  }
  .duel-overtake {
    position: static;
    display: inline-block;
    translate: none;
    margin-left: 6px;
  }
  .duel-status {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
