<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_VOICE_AVATARS_STATE, getMemberMonogram } from './types'
import type { VoiceAvatarsAction, VoiceAvatarsState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<VoiceAvatarsState, VoiceAvatarsAction>({
  componentId: 'voice-avatars',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_VOICE_AVATARS_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const speakingMap = reactive<Record<string, { speaking: boolean; level: number }>>({})
const brokenImages = ref(new Set<string>())

function isSpeaking(memberId: string): boolean {
  return Boolean(speakingMap[memberId]?.speaking)
}

function getLevelScale(memberId: string): number {
  const entry = speakingMap[memberId]
  if (!entry?.speaking) return 1
  const boost = Math.min(0.08, (entry.level / 100) * 0.08)
  return Number((1.04 + boost).toFixed(3))
}

function markImageBroken(url: string) {
  if (!url) return
  const next = new Set(brokenImages.value)
  next.add(url)
  brokenImages.value = next
}

function hasUsableAvatar(url: string): boolean {
  return Boolean(url?.trim()) && !brokenImages.value.has(url)
}

const visibleMembers = computed(() => {
  const members = state.value.members || []
  if (!state.value.hideMuted) return members
  return members.filter((m) => isSpeaking(m.id))
})

const gridColumns = computed(() => {
  const count = visibleMembers.value.length
  if (count <= 2) return count || 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
})

const stageStyle = computed(() => {
  const base: Record<string, string> = {
    gap: `${state.value.gap}px`,
  }
  if (state.value.layout === 'grid') {
    base.gridTemplateColumns = `repeat(${gridColumns.value}, minmax(0, auto))`
  }
  return base
})

let disposeAction: (() => void) | undefined

onMounted(() => {
  disposeAction = onAction((action) => {
    if (action.type === 'SPEAKING_STATE') {
      speakingMap[action.memberId] = {
        speaking: action.speaking,
        level: Math.max(0, Math.min(100, action.level)),
      }
    } else if (action.type === 'RESET_ALL_SPEAKING') {
      for (const key of Object.keys(speakingMap)) {
        speakingMap[key] = { speaking: false, level: 0 }
      }
    }
  })
})

onUnmounted(() => {
  disposeAction?.()
})
</script>

<template>
  <div
    class="va-obs-root"
    :class="[`theme-${state.theme}`, { 'is-inline': props.inlineMode, 'no-shadow': props.noShadow }]"
    :style="{ fontFamily: customFontCss }"
  >
    <TransitionGroup
      name="va-member"
      tag="div"
      class="va-stage"
      :class="`layout-${state.layout}`"
      :style="stageStyle"
    >
      <div
        v-for="member in visibleMembers"
        :key="member.id"
        class="va-slot"
        :class="{ 'is-speaking': isSpeaking(member.id), 'is-muted': !isSpeaking(member.id) }"
        :style="{
          '--va-accent': member.accentColor || '#38bdf8',
          '--va-size': `${state.avatarSize}px`,
        }"
      >
        <div
          class="va-avatar-wrap"
          :class="`shape-${state.shape}`"
          :style="
            isSpeaking(member.id) ? { transform: `translateY(-6px) scale(${getLevelScale(member.id)})` } : undefined
          "
        >
          <span
            v-if="isSpeaking(member.id)"
            class="va-halo"
            :class="`shape-${state.shape}`"
            aria-hidden="true"
          />

          <div
            class="va-avatar-frame"
            :class="`shape-${state.shape}`"
          >
            <img
              v-if="hasUsableAvatar(member.avatarUrl)"
              :src="member.avatarUrl"
              :alt="member.name"
              class="va-avatar-img"
              @error="markImageBroken(member.avatarUrl)"
            />
            <div
              v-else
              class="va-monogram"
            >
              {{ getMemberMonogram(member.name) }}
            </div>
          </div>
        </div>

        <div
          v-if="state.showName"
          class="va-name-pill"
        >
          {{ member.name || '未命名' }}
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.va-obs-root {
  width: 100%;
  height: 100%;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.va-stage {
  display: flex;
  align-items: center;
  justify-content: center;
}

.va-stage.layout-row {
  flex-direction: row;
  flex-wrap: nowrap;
}

.va-stage.layout-column {
  flex-direction: column;
}

.va-stage.layout-grid {
  display: grid;
  justify-items: center;
  align-items: center;
}

.va-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.va-slot.is-muted {
  opacity: 0.62;
  transform: scale(0.95);
}

.va-slot.is-speaking {
  opacity: 1;
  transform: scale(1);
}

.va-avatar-wrap {
  position: relative;
  width: var(--va-size, 78px);
  height: var(--va-size, 78px);
  transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.va-halo {
  position: absolute;
  inset: -4px;
  border: 2px solid var(--va-accent, #38bdf8);
  opacity: 0.7;
  pointer-events: none;
  animation: va-pulse-ring 1.1s ease-out infinite;
}

@keyframes va-pulse-ring {
  0% {
    transform: scale(1);
    opacity: 0.72;
  }
  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}

.va-avatar-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.85);
  box-sizing: border-box;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.va-slot.is-speaking .va-avatar-frame {
  border-color: var(--va-accent, #38bdf8);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--va-accent, #38bdf8) 45%, transparent),
    0 8px 22px color-mix(in srgb, var(--va-accent, #38bdf8) 48%, transparent);
}

.shape-circle {
  border-radius: 9999px;
}

.shape-rounded {
  border-radius: 18%;
}

.va-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.va-monogram {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--va-size, 78px) * 0.4);
  font-weight: 800;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--va-accent, #38bdf8) 72%, #0f172a),
    color-mix(in srgb, var(--va-accent, #38bdf8) 38%, #0f172a)
  );
}

.va-name-pill {
  max-width: calc(var(--va-size, 78px) + 32px);
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
  background: rgba(15, 18, 28, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.va-slot.is-speaking .va-name-pill {
  background: var(--va-accent, #38bdf8);
  border-color: var(--va-accent, #38bdf8);
  color: #ffffff;
}

/* 成员进出场动画 */
.va-member-enter-active,
.va-member-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.va-member-enter-from,
.va-member-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

/* 4 套主题 */
.theme-card .va-stage {
  padding: 14px 20px;
  border-radius: 16px;
  background: rgba(17, 17, 22, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

.theme-minimal .va-name-pill {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.theme-neon .va-stage {
  padding: 14px 20px;
  border-radius: 14px;
  background: rgba(8, 10, 18, 0.9);
  border: 1px solid rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 22px rgba(56, 189, 248, 0.2);
}

.theme-neon .va-slot.is-speaking .va-avatar-frame {
  box-shadow:
    0 0 0 2px var(--va-accent, #38bdf8),
    0 0 24px color-mix(in srgb, var(--va-accent, #38bdf8) 78%, transparent);
}

.theme-glass .va-stage {
  padding: 14px 20px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06));
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.no-shadow .va-stage,
.no-shadow .va-avatar-frame,
.no-shadow .va-name-pill {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
