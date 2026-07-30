<script setup lang="ts">
import { NIcon } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { TimerOutline, HourglassOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  title?: string
  target?: string
  style?: 'cards' | 'inline'
  showSeconds?: boolean
  doneText?: string
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    title: typeof o.title === 'string' ? o.title : '',
    target: typeof o.target === 'string' ? o.target : '',
    style: (o.style === 'cards' || o.style === 'inline') ? o.style : 'cards',
    showSeconds: typeof o.showSeconds === 'boolean' ? o.showSeconds : true,
    doneText: typeof o.doneText === 'string' ? o.doneText : '已到达',
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
  }
})

function parseTarget(raw: string): number | null {
  const v = raw.trim()
  if (!v) return null
  const ms = Date.parse(v)
  if (Number.isFinite(ms)) return ms
  const normalized = v.replace(' ', 'T')
  const ms2 = Date.parse(normalized)
  if (Number.isFinite(ms2)) return ms2
  return null
}

const now = ref(Date.now())
let timer: number | null = null
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer)
  timer = null
})

const targetMs = computed(() => parseTarget(cfg.value.target ?? ''))
const diff = computed(() => {
  if (!targetMs.value) return null
  return targetMs.value - now.value
})

const breakdown = computed(() => {
  const ms = diff.value
  if (ms === null) return null
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  return { done: false, days, hours, minutes, seconds }
})
</script>

<template>
  <BlockCard
    class="countdown-card bold-mode"
    :class="{ 'has-bg': cfg.backgrounded }"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div class="countdown-inner" :class="{ 'countdown-inner--bare': !cfg.backgrounded }">
      <!-- 集成式标题区 -->
      <div class="cd-header-integrated">
        <NIcon size="14" class="cd-icon">
          <TimerOutline />
        </NIcon>
        <span class="cd-title">{{ cfg.title || '倒计时' }}</span>
      </div>

      <div v-if="!targetMs" class="cd-placeholder">
        未设置目标时间
      </div>

      <div v-else-if="breakdown?.done" class="done-display">
        <div class="done-icon-wrapper">
          <NIcon size="32" color="var(--vtsuru-page-primary, var(--vtsuru-brand))">
            <HourglassOutline />
          </NIcon>
        </div>
        <div class="done-text">
          {{ cfg.doneText || '已到达' }}
        </div>
      </div>

      <template v-else>
        <!-- 数字展示区 -->
        <div
          v-if="cfg.style === 'cards'"
          class="cd-digits-wrapper"
          :class="{ 'without-seconds': !cfg.showSeconds }"
        >
          <div class="digit-box">
            <div class="val">
              {{ breakdown?.days ?? 0 }}
            </div>
            <div class="lbl">
              天
            </div>
          </div>

          <div class="sep">
            :
          </div>

          <div class="digit-box">
            <div class="val">
              {{ breakdown?.hours?.toString().padStart(2,'0') ?? '00' }}
            </div>
            <div class="lbl">
              时
            </div>
          </div>

          <div class="sep">
            :
          </div>

          <div class="digit-box">
            <div class="val">
              {{ breakdown?.minutes?.toString().padStart(2,'0') ?? '00' }}
            </div>
            <div class="lbl">
              分
            </div>
          </div>

          <template v-if="cfg.showSeconds">
            <div class="sep">
              :
            </div>
            <div class="digit-box highlight">
              <div class="val">
                {{ breakdown?.seconds?.toString().padStart(2,'0') ?? '00' }}
              </div>
              <div class="lbl">
                秒
              </div>
            </div>
          </template>
        </div>

        <div v-else class="inline-time bold">
          <span>{{ breakdown?.days ?? 0 }}</span> <small>天</small>
          <span>{{ breakdown?.hours?.toString().padStart(2,'0') }}</span> <small>时</small>
          <span>{{ breakdown?.minutes?.toString().padStart(2,'0') }}</span> <small>分</small>
          <template v-if="cfg.showSeconds">
            <span>{{ breakdown?.seconds?.toString().padStart(2,'0') }}</span> <small>秒</small>
          </template>
        </div>
      </template>
    </div>
  </BlockCard>
</template>

<style scoped>
.countdown-card.bold-mode {
  container-type: inline-size;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  position: relative;
}

.countdown-card.bold-mode.has-bg {
  background: var(--vtsuru-bg-elevated);
}

/* 移除默认 Header 占位影响 */
.countdown-card.bold-mode :deep(.n-card-header) {
  display: none;
}
.countdown-card.bold-mode :deep(.n-card__content) {
  padding: 0 !important;
}

.countdown-inner {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 140px;
}

.countdown-inner--bare {
  border-radius: var(--vtsuru-page-radius);
  background: color-mix(
    in srgb,
    var(--vtsuru-page-content-color, var(--user-page-ui-surface-bg)) 54%,
    transparent
  );
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.cd-header-integrated {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  border-bottom: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  padding-bottom: 4px;
  padding-left: 8px;
  padding-right: 8px;
  color: var(--vtsuru-fg-muted);
}

.cd-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.cd-placeholder {
  padding: 20px;
  color: var(--vtsuru-fg-muted);
}

.cd-digits-wrapper {
  display: grid;
  grid-template-columns: minmax(44px, 1fr) auto minmax(44px, 1fr) auto minmax(44px, 1fr) auto minmax(44px, 1fr);
  align-items: flex-start;
  gap: 4px;
  width: min(100%, 340px);
}

.cd-digits-wrapper.without-seconds {
  grid-template-columns: minmax(44px, 1fr) auto minmax(44px, 1fr) auto minmax(44px, 1fr);
  width: min(100%, 250px);
}

.digit-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.digit-box .val {
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  font-family: ui-monospace, 'Menlo', 'Monaco', monospace; /* Monospace for tech feel */
}

.digit-box .lbl {
  color: var(--vtsuru-fg-muted);
  font-size: 10px;
  font-weight: 600;
  margin-top: 6px;
  letter-spacing: 0;
}

.sep {
  font-size: 28px;
  font-weight: 300;
  color: var(--vtsuru-fg-muted);
  margin-top: 2px;
  user-select: none;
}

.digit-box.highlight .val {
  color: var(--vtsuru-page-primary, var(--vtsuru-brand));
}

.done-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.done-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
}

@container (max-width: 420px) {
  .countdown-inner { padding: 16px 10px; }
  .cd-digits-wrapper { gap: 2px; grid-template-columns: minmax(38px, 1fr) auto minmax(38px, 1fr) auto minmax(38px, 1fr) auto minmax(38px, 1fr); }
  .cd-digits-wrapper.without-seconds { grid-template-columns: minmax(38px, 1fr) auto minmax(38px, 1fr) auto minmax(38px, 1fr); }
  .digit-box .val { font-size: 30px; }
  .sep { font-size: 22px; }
  .inline-time.bold { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 4px; }
}

.inline-time.bold {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--vtsuru-page-text, var(--vtsuru-fg));
}
.inline-time.bold small {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  margin-right: 8px;
  text-transform: uppercase;
}
</style>
