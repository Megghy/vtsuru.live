<script setup lang="ts">
import { CalendarNumberOutline, CheckmarkOutline, CopyOutline, OpenOutline } from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ url: string }>()

const copyState = ref<'idle' | 'success' | 'error'>('idle')
const webcalUrl = computed(() => props.url.replace(/^https?:\/\//, 'webcal://'))
let resetTimer: number | undefined

async function copyUrl() {
  if (copyState.value === 'success') return

  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
  try {
    await navigator.clipboard.writeText(props.url)
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
    aria-label="订阅直播日程"
  >
    <div class="subscription-copy">
      <span
        class="subscription-icon"
        aria-hidden="true"
      >
        <NIcon size="20"><CalendarNumberOutline /></NIcon>
      </span>
      <span class="subscription-text">
        <strong>订阅直播日程</strong>
        <span>添加到日历后，后续日程更新会自动同步</span>
      </span>
    </div>

    <div class="subscription-action">
      <input
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
        <template #icon
          ><NIcon><OpenOutline /></NIcon
        ></template>
        打开日历
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
        {{ copyState === 'success' ? '已复制' : copyState === 'error' ? '复制失败' : '复制链接' }}
      </NButton>
    </div>
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
.subscription-text span {
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

.subscription-action input {
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

.subscription-action input:focus-visible {
  border-color: var(--schedule-subscription-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--schedule-subscription-accent) 18%, transparent);
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

@media (max-width: 520px) {
  .schedule-subscription {
    gap: 12px;
  }
  .subscription-action {
    flex: 1 1 100%;
    width: 100%;
  }
  .subscription-action input {
    flex: 1 1 100%;
  }
  .subscription-action :deep(.n-button) {
    flex: 1 1 0;
  }
}
</style>
