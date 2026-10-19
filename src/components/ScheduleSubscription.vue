<script setup lang="ts">
import {
  CalendarNumberOutline,
  CheckmarkOutline,
  ChevronDownOutline,
  CopyOutline,
  OpenOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { NButton, NCollapseTransition, NIcon, NPopover } from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    url: string
    docked?: boolean
  }>(),
  {
    docked: false,
  },
)

const reminderOptions: { value: number | null; label: string }[] = [
  { value: null, label: '不提醒' },
  { value: 5, label: '提前5分钟' },
  { value: 10, label: '提前10分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
  { value: 180, label: '提前3小时' },
  { value: 1440, label: '提前1天' },
  { value: 2880, label: '提前2天' },
]
const tagOptions: { value: boolean; label: string }[] = [
  { value: false, label: '不带标签' },
  { value: true, label: '附带标签' },
]

const reminder = ref<number | null>(5)
const withTag = ref(false)
const settingsOpen = ref(false)
const popoverOpen = ref(false)
const url = computed(() => {
  const target = new URL(props.url)
  if (reminder.value === null) target.searchParams.delete('remind')
  else target.searchParams.set('remind', String(reminder.value))
  if (withTag.value) target.searchParams.set('tag', '1')
  else target.searchParams.delete('tag')
  return target.toString()
})
const webcalUrl = computed(() => url.value.replace(/^https?:\/\//, 'webcal://'))
const reminderLabel = computed(() => reminderOptions.find((option) => option.value === reminder.value)?.label ?? '')
const settingsSummary = computed(() => {
  const values = [reminderLabel.value]
  if (withTag.value) values.push('附带标题标签')
  return values.join(' · ')
})

const copyState = ref<'idle' | 'success' | 'error'>('idle')
let resetTimer: number | undefined

async function copyUrl() {
  if (copyState.value === 'success') return

  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
  try {
    await navigator.clipboard.writeText(url.value)
    copyState.value = 'success'
  } catch {
    copyState.value = 'error'
  }
  resetTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 3000)
}

function selectUrl(event: FocusEvent | MouseEvent) {
  ;(event.currentTarget as HTMLInputElement).select()
}

onBeforeUnmount(() => {
  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
})
</script>

<template>
  <aside
    class="schedule-subscription"
    :class="{ 'is-docked': docked }"
    aria-label="订阅直播日程"
  >
    <div class="subscription-copy">
      <span
        class="subscription-icon"
        aria-hidden="true"
      >
        <NIcon :size="docked ? 18 : 20"><CalendarNumberOutline /></NIcon>
      </span>
      <span class="subscription-text">
        <strong>订阅直播日程</strong>
        <span class="subscription-hint">添加到日历后，日程更新自动同步</span>
      </span>
    </div>

    <div class="subscription-action">
      <input
        v-if="!docked"
        :value="url"
        readonly
        aria-label="日历订阅链接"
        @focus="selectUrl"
        @click="selectUrl"
      />
      <NButton
        tag="a"
        :href="webcalUrl"
        size="small"
        type="primary"
        secondary
      >
        <template #icon>
          <NIcon><OpenOutline /></NIcon>
        </template>
        <span class="btn-text-full">打开日历</span>
        <span class="btn-text-short">日历</span>
      </NButton>
      <NButton
        size="small"
        type="primary"
        secondary
        :disabled="copyState === 'success'"
        @click="copyUrl"
      >
        <template #icon>
          <NIcon>
            <CheckmarkOutline v-if="copyState === 'success'" />
            <CopyOutline v-else />
          </NIcon>
        </template>
        <span class="btn-text-full">{{ copyState === 'success' ? '已复制' : copyState === 'error' ? '复制失败' : '复制链接' }}</span>
        <span class="btn-text-short">{{ copyState === 'success' ? '已复制' : copyState === 'error' ? '失败' : '复制' }}</span>
      </NButton>

      <!-- 悬浮坞模式下的设置弹层 -->
      <NPopover
        v-if="docked"
        v-model:show="popoverOpen"
        trigger="click"
        placement="top-end"
        :show-arrow="false"
        class="dock-settings-popover"
        style="width: min(300px, calc(100vw - 32px)); padding: 12px 14px"
      >
        <template #trigger>
          <NButton
            size="small"
            quaternary
            circle
            :title="`订阅设置 (${settingsSummary})`"
            :aria-label="`订阅设置 (${settingsSummary})`"
          >
            <template #icon>
              <NIcon><SettingsOutline /></NIcon>
            </template>
          </NButton>
        </template>

        <div class="dock-settings-panel">
          <div class="dock-settings-header">
            <strong>订阅参数设置</strong>
            <span class="dock-settings-sub">{{ settingsSummary }}</span>
          </div>

          <div class="subscription-setting">
            <span class="setting-label">开播提醒</span>
            <div class="setting-options-wrap">
              <button
                v-for="opt in reminderOptions"
                :key="`dock-r-${opt.value}`"
                type="button"
                class="setting-option"
                :class="{ active: reminder === opt.value }"
                :aria-pressed="reminder === opt.value"
                @click="reminder = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="subscription-setting">
            <span class="setting-label">标题标签</span>
            <div class="setting-options-wrap">
              <button
                v-for="opt in tagOptions"
                :key="`dock-t-${opt.value}`"
                type="button"
                class="setting-option"
                :class="{ active: withTag === opt.value }"
                :aria-pressed="withTag === opt.value"
                @click="withTag = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="dock-url-preview">
            <input
              :value="url"
              readonly
              aria-label="日历订阅链接"
              @focus="selectUrl"
              @click="selectUrl"
            />
          </div>
        </div>
      </NPopover>
    </div>

    <!-- 普通内联模式下的可折叠设置栏 -->
    <template v-if="!docked">
      <div class="subscription-settings-bar">
        <span class="settings-summary">{{ settingsSummary }}</span>
        <button
          type="button"
          class="settings-toggle"
          :aria-expanded="settingsOpen"
          aria-controls="schedule-subscription-settings"
          @click="settingsOpen = !settingsOpen"
        >
          <NIcon size="15"><SettingsOutline /></NIcon>
          <span>订阅设置</span>
          <NIcon
            class="settings-toggle-arrow"
            size="14"
            :class="{ expanded: settingsOpen }"
            aria-hidden="true"
          >
            <ChevronDownOutline />
          </NIcon>
        </button>
      </div>

      <NCollapseTransition :show="settingsOpen">
        <div
          id="schedule-subscription-settings"
          class="subscription-settings"
        >
          <div class="subscription-setting">
            <span class="setting-label">开播提醒</span>
            <button
              v-for="opt in reminderOptions"
              :key="`r-${opt.value}`"
              type="button"
              class="setting-option"
              :class="{ active: reminder === opt.value }"
              :aria-pressed="reminder === opt.value"
              @click="reminder = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>

          <div class="subscription-setting">
            <span class="setting-label">标题标签</span>
            <button
              v-for="opt in tagOptions"
              :key="`t-${opt.value}`"
              type="button"
              class="setting-option"
              :class="{ active: withTag === opt.value }"
              :aria-pressed="withTag === opt.value"
              @click="withTag = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </NCollapseTransition>
    </template>

    <span
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ copyState === 'success' ? '日历订阅链接已复制' : copyState === 'error' ? '复制失败，请手动复制链接' : '' }}
    </span>
  </aside>
</template>

<style scoped>
.schedule-subscription {
  --schedule-subscription-fg: var(
    --vtsuru-block-fg,
    var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg)))
  );
  --schedule-subscription-muted: var(
    --vtsuru-block-fg-muted,
    var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted)))
  );
  --schedule-subscription-bg: var(
    --vtsuru-block-bg-muted,
    var(--user-page-theme-surface-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-muted)))
  );
  --schedule-subscription-control-bg: var(
    --user-page-theme-surface-bg-hover,
    var(--vtsuru-block-bg-muted, var(--vtsuru-bg-muted))
  );
  --schedule-subscription-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --schedule-subscription-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));
  --schedule-subscription-accent-readable: var(--vtsuru-page-primary-readable, var(--schedule-subscription-accent));
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 13px 14px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style)
    color-mix(in srgb, var(--schedule-subscription-accent) 22%, var(--schedule-subscription-border));
  border-radius: var(--vtsuru-page-radius, 8px);
  color: var(--schedule-subscription-fg);
  background: color-mix(in srgb, var(--schedule-subscription-accent) 6%, var(--schedule-subscription-bg));
  box-shadow: var(--vtsuru-page-shadow);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

/* 吸底悬浮坞 (Docked) 专属样式 */
.schedule-subscription.is-docked {
  position: sticky;
  bottom: 20px;
  z-index: 25;
  width: min(100%, 740px);
  margin-inline: auto;
  padding: 8px 14px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--schedule-subscription-bg) 84%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--schedule-subscription-accent) 28%, var(--schedule-subscription-border));
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.32), 0 2px 8px rgba(0, 0, 0, 0.12);
  flex-wrap: nowrap;
  gap: 12px;
}

.schedule-subscription.is-docked .subscription-copy {
  flex: 1 1 auto;
  gap: 10px;
}

.schedule-subscription.is-docked .subscription-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.schedule-subscription.is-docked .subscription-text {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.schedule-subscription.is-docked .subscription-text strong {
  font-size: 13px;
  white-space: nowrap;
}

.schedule-subscription.is-docked .subscription-hint {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-subscription.is-docked .subscription-action {
  flex: none;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.subscription-copy {
  display: flex;
  flex: 1 1 240px;
  gap: 11px;
  align-items: center;
  min-width: 0;
}

.subscription-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 7px;
  color: var(--schedule-subscription-accent-readable);
  background: color-mix(in srgb, var(--schedule-subscription-accent) 14%, transparent);
}

.subscription-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.subscription-text strong {
  font-size: 13px;
  line-height: 1.4;
}

.subscription-hint {
  color: var(--schedule-subscription-muted);
  font-size: 12px;
  line-height: 1.45;
}

.subscription-action {
  display: flex;
  flex: 0 1 430px;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.subscription-action input,
.dock-url-preview input {
  box-sizing: border-box;
  flex: 0 1 230px;
  min-width: 0;
  width: 100%;
  min-height: var(--vtsuru-page-control-height-small);
  padding: 6px 9px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-subscription-border);
  border-radius: var(--vtsuru-page-radius);
  outline: none;
  color: var(--schedule-subscription-muted);
  background: var(--schedule-subscription-control-bg);
  font:
    12px/1.5 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.subscription-action input:focus-visible,
.dock-url-preview input:focus-visible {
  border-color: var(--schedule-subscription-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--schedule-subscription-accent) 18%, transparent);
}

.subscription-settings-bar {
  display: flex;
  flex: 1 1 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding-top: 2px;
}

.settings-summary {
  min-width: 0;
  overflow: hidden;
  color: var(--schedule-subscription-muted);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 2px 6px;
  border: 0;
  border-radius: var(--vtsuru-page-radius, 8px);
  color: var(--schedule-subscription-accent-readable);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.settings-toggle:hover {
  background: color-mix(in srgb, var(--schedule-subscription-accent) 10%, transparent);
}

.settings-toggle:focus-visible {
  outline: 2px solid var(--schedule-subscription-accent);
  outline-offset: 2px;
}

.settings-toggle-arrow {
  transition: transform 120ms ease;
}

.settings-toggle-arrow.expanded {
  transform: rotate(180deg);
}

.subscription-settings {
  flex: 1 1 100%;
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-top: 2px;
}

.subscription-setting {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.setting-options-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.setting-label {
  color: var(--schedule-subscription-muted);
  font-size: 12px;
}

.setting-option {
  min-height: 26px;
  padding: 0 11px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-subscription-border);
  border-radius: 999px;
  background: transparent;
  color: var(--schedule-subscription-muted);
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.setting-option:hover {
  border-color: color-mix(in srgb, var(--schedule-subscription-accent) 55%, var(--schedule-subscription-border));
  color: var(--schedule-subscription-fg);
}

.setting-option.active {
  border-color: var(--schedule-subscription-accent);
  background: color-mix(in srgb, var(--schedule-subscription-accent) 14%, transparent);
  color: var(--schedule-subscription-accent-readable);
}

.setting-option:focus-visible {
  outline: 2px solid var(--schedule-subscription-accent);
  outline-offset: 2px;
}

.dock-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.dock-settings-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--schedule-subscription-border);
}

.dock-settings-header strong {
  font-size: 13px;
  color: var(--schedule-subscription-fg);
}

.dock-settings-sub {
  font-size: 11px;
  color: var(--schedule-subscription-muted);
}

.dock-url-preview {
  margin-top: 2px;
  width: 100%;
}

.dock-url-preview input {
  width: 100%;
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.btn-text-short {
  display: none;
}

.btn-text-full {
  display: inline;
}

@media (max-width: 520px) {
  .btn-text-full {
    display: none;
  }
  .btn-text-short {
    display: inline;
  }

  .schedule-subscription:not(.is-docked) {
    gap: 12px;
  }
  .schedule-subscription:not(.is-docked) .subscription-action {
    flex: 1 1 100%;
    width: 100%;
  }
  .schedule-subscription:not(.is-docked) .subscription-action input {
    flex: 1 1 100%;
  }
  .schedule-subscription:not(.is-docked) .subscription-action :deep(.n-button) {
    flex: 1 1 0;
  }

  /* 移动端吸底坞样式，避开底部导航栏 */
  .schedule-subscription.is-docked {
    bottom: calc(58px + env(safe-area-inset-bottom, 0px) + 10px);
    width: calc(100% - 20px);
    border-radius: 9999px;
    padding: 7px 10px;
    gap: 6px;
    justify-content: space-between;
  }
  .schedule-subscription.is-docked .subscription-copy {
    flex: 0 1 auto;
    min-width: 0;
    gap: 7px;
  }
  .schedule-subscription.is-docked .subscription-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }
  .schedule-subscription.is-docked .subscription-text strong {
    font-size: 12px;
  }
  .schedule-subscription.is-docked .subscription-hint {
    display: none;
  }
  .schedule-subscription.is-docked .subscription-action {
    flex: 0 0 auto;
    gap: 5px;
  }
  .schedule-subscription.is-docked .subscription-action :deep(.n-button) {
    padding: 0 8px;
    font-size: 12px;
  }
}
</style>
