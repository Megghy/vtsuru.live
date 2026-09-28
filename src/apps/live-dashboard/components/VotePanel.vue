<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { Open16Regular, Stop16Regular } from '@vicons/fluent'
import { openUrl } from '@tauri-apps/plugin-opener'
import { NButton, NCheckbox, NIcon, NInput, NInputNumber, NPopconfirm, NTag } from 'naive-ui'
import { computed, ref } from 'vue'

import { CURRENT_HOST, isTauri } from '@/shared/config'
import { formatCountdown, remainingMs } from '@/shared/utils/countdown'
import type { VotePreset } from '@/shared/utils/votePresets'
import { useVoteTemplates, VOTE_QUICK_PRESETS } from '@/shared/utils/votePresets'
import { voteOutcomeLabel } from '@/shared/utils/voteStandings'

import { useDashboardVote } from '../store/vote'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const { session, loaded, busy, pollError, options, standings, ...vote } = useDashboardVote()
const templates = useVoteTemplates()
const presets = computed(() => [...VOTE_QUICK_PRESETS, ...templates.value])
const now = useNow({ interval: 1000 })

const active = computed(() => !!session.value?.isActive)
const timeLeft = computed(() => remainingMs(session.value?.endTime, now.value.getTime()))
const outcome = computed(() => voteOutcomeLabel(standings.value, !active.value))

const title = ref('')
const optionsText = ref('')
const duration = ref(60)
const allowMultiple = ref(false)
const draftOptions = computed(() => optionsText.value.split('\n').map((line) => line.trim()).filter(Boolean))

function applyPreset(preset: VotePreset) {
  title.value = preset.title
  optionsText.value = preset.options.join('\n')
}

function reuse() {
  applyPreset({ name: '', title: session.value!.title, options: session.value!.options.map((o) => o.text) })
}

function create() {
  void vote.create({
    title: title.value.trim(),
    options: draftOptions.value,
    allowMultipleVotes: allowMultiple.value,
    durationSeconds: duration.value > 0 ? duration.value : undefined,
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
      <NTag
        v-if="pollError"
        size="tiny"
        type="error"
        :bordered="false"
        :title="pollError"
      >
        同步失败
      </NTag>
      <IconAction
        :icon="Open16Regular"
        tip="打开投票管理（OBS 链接、全局设置、历史）"
        @click="openManage"
      />
    </template>
    <div class="vote">
      <section
        v-if="session"
        class="vote__result"
      >
        <div class="vote__head">
          <span
            v-if="active"
            class="vote__live"
          />
          <span class="vote__title">{{ session.title }}</span>
          <span class="vote__meta">
            {{ active ? (timeLeft === null ? '不限时' : formatCountdown(timeLeft)) : '已结束' }}
            · {{ session.totalVotes }} 票
          </span>
        </div>
        <div
          v-for="option in options"
          :key="option.index"
          class="vote__option"
          :class="{ 'vote__option--lead': standings.leaders.some((l) => l.index === option.index) }"
        >
          <div class="vote__bar" :style="{ width: `${option.percentage}%` }" />
          <span class="vote__index">{{ option.index }}</span>
          <span class="vote__text">{{ option.text }}</span>
          <span class="vote__count">{{ option.count }} · {{ Math.round(option.percentage) }}%</span>
        </div>
        <div class="vote__foot">
          <span class="vote__outcome">{{ outcome }}</span>
          <template v-if="active">
            <NButton
              v-for="seconds in [30, 60]"
              :key="seconds"
              size="tiny"
              secondary
              :disabled="busy"
              @click="vote.extend(seconds)"
            >
              +{{ seconds }}s
            </NButton>
            <NPopconfirm @positive-click="vote.end(session.id)">
              <template #trigger>
                <NButton
                  size="tiny"
                  type="warning"
                  secondary
                  :loading="busy"
                >
                  <template #icon>
                    <NIcon :component="Stop16Regular" />
                  </template>
                  结束
                </NButton>
              </template>
              提前结束并展示结果？
            </NPopconfirm>
          </template>
          <NButton
            v-else
            size="tiny"
            secondary
            @click="reuse"
          >
            复用选项
          </NButton>
        </div>
      </section>

      <section
        v-if="!active && loaded"
        class="vote__form"
      >
        <div class="vote__presets">
          <NButton
            v-for="(preset, index) in presets"
            :key="index"
            size="tiny"
            quaternary
            @click="applyPreset(preset)"
          >
            {{ preset.name }}
          </NButton>
        </div>
        <NInput
          v-model:value="title"
          size="small"
          placeholder="投票标题"
          maxlength="50"
        />
        <NInput
          v-model:value="optionsText"
          type="textarea"
          size="small"
          placeholder="每行一个选项，观众发送序号或选项文字投票"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
        <div class="vote__row">
          <NInputNumber
            v-model:value="duration"
            size="small"
            :min="0"
            :step="30"
            style="width: 120px"
          >
            <template #suffix>
              秒
            </template>
          </NInputNumber>
          <NCheckbox
            v-model:checked="allowMultiple"
            size="small"
          >
            允许多选
          </NCheckbox>
          <NButton
            size="small"
            type="primary"
            :loading="busy"
            :disabled="!title.trim() || draftOptions.length < 2"
            style="margin-left: auto"
            @click="create"
          >
            发起
          </NButton>
        </div>
        <div class="vote__hint">
          时长为 0 表示不限时；新投票会结束当前进行中的投票
        </div>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.vote {
  display: grid;
  align-content: start;
  gap: 12px;
  box-sizing: border-box;
  height: 100%;
  padding: 10px;
  overflow-y: auto;
  font-size: 13px;
}

.vote__result,
.vote__form {
  display: grid;
  gap: 6px;
}

.vote__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.vote__live {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--vtsuru-success);
  animation: pulse 1.6s ease-in-out infinite;
}

.vote__title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote__meta {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

.vote__option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.vote__bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--vtsuru-bg-muted);
  transition: width 0.4s ease;
}

.vote__option--lead .vote__bar {
  background: color-mix(in srgb, var(--vtsuru-primary) 22%, transparent);
}

.vote__index,
.vote__text,
.vote__count {
  position: relative;
}

.vote__index {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
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

.vote__foot,
.vote__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vote__outcome {
  margin-right: auto;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.vote__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.vote__hint {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

@keyframes pulse {
  50% { opacity: 0.35; }
}
</style>
