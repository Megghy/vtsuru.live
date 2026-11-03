<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { ResponseUserInfo } from '@/api/generated/model'

import { attachCustomHtmlBridge } from '../../runtime/customHtmlBridge'
import type { VtsuruSandboxSdkTheme } from '../../runtime/customHtmlBridge'
import CustomHtmlHostDialogs from '../../runtime/CustomHtmlHostDialogs.vue'
import { useCustomHtmlBridge } from '../../runtime/useCustomHtmlBridge'
import type { BiliProfile } from '../../types'
import BlockCard from '../BlockCard.vue'
import type { CompiledCustomVue } from '../customHtmlCompile'
import { CUSTOM_HTML_MIN_AUTO_HEIGHT, normalizeCustomHtmlProps } from '../customHtmlContract'
import { buildCustomHtmlDocument } from '../customHtmlDocument'
import type { CustomHtmlTheme } from '../customHtmlRuntime'

const props = defineProps<{
  blockProps: unknown
  theme?: CustomHtmlTheme
  userInfo?: ResponseUserInfo
  biliInfo?: BiliProfile
  pageSlug?: string | null
  pageMode?: 'block' | 'custom'
}>()
const route = useRoute()
const host = ref<HTMLElement | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const contentHeight = ref(CUSTOM_HTML_MIN_AUTO_HEIGHT)
const runtimeError = ref('')
const themeReady = ref(Boolean(props.theme))
const compiled = shallowRef<CompiledCustomVue>({ js: '', css: '', issues: [] })
const detectedTheme = ref<CustomHtmlTheme>({
  fg: '#18181b',
  fgMuted: '#71717a',
  bg: '#ffffff',
  bgElevated: '#ffffff',
  border: '#e4e4e7',
  primary: '#18a058',
  primaryReadable: '#166534',
  radius: '8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  shadow: 'none',
  colorScheme: 'light',
})
let themeObserver: MutationObserver | null = null
let detachBridge: ReturnType<typeof attachCustomHtmlBridge> | null = null

const config = computed(() => normalizeCustomHtmlProps(props.blockProps))
const activeTheme = computed(() => props.theme ?? detectedTheme.value)
const sdkTheme = computed<VtsuruSandboxSdkTheme>(() => ({
  isDark: activeTheme.value.colorScheme === 'dark',
  primaryColor: activeTheme.value.primary,
  accentColor: activeTheme.value.primaryReadable,
  bgColor: activeTheme.value.bg,
  fgColor: activeTheme.value.fg,
  cardBg: activeTheme.value.bgElevated,
  borderColor: activeTheme.value.border,
  mutedColor: activeTheme.value.fgMuted,
}))
const { handlers, dialog, cancelPending } = useCustomHtmlBridge({
  userInfo: () => props.userInfo,
  biliInfo: () => props.biliInfo,
  pageSlug: () => props.pageSlug ?? (typeof route?.params.pageSlug === 'string' ? route.params.pageSlug : null),
  pageMode: () => props.pageMode ?? 'block',
  immersive: () => config.value.immersive,
  assets: () => config.value.assets,
  theme: sdkTheme,
})
const initialTheme = shallowRef<CustomHtmlTheme | null>(props.theme ?? null)
const compileError = computed(() => compiled.value.issues.map((item) => item.message).join('；'))
const documentResult = computed(() => {
  if (compiled.value.issues.length) return { srcdoc: '', channelId: '', issues: compiled.value.issues }
  return buildCustomHtmlDocument(config.value, initialTheme.value ?? detectedTheme.value, compiled.value)
})
const iframeHeight = computed(() => {
  const measured = Math.max(CUSTOM_HTML_MIN_AUTO_HEIGHT, contentHeight.value)
  return config.value.heightMode === 'fixed'
    ? config.value.height
    : config.value.heightMode === 'auto'
      ? Math.min(config.value.maxHeight, measured)
      : measured
})

watchDebounced(
  () => config.value.source,
  async (source) => {
    const { compileCustomVueSfc } = await import('../customHtmlCompile')
    compiled.value = compileCustomVueSfc(source)
  },
  { debounce: 200, immediate: true },
)

function readTheme() {
  if (!host.value) return
  const style = getComputedStyle(host.value)
  const nextTheme: CustomHtmlTheme = {
    fg: style.getPropertyValue('--foreground').trim() || '#18181b',
    fgMuted: style.getPropertyValue('--muted-foreground').trim() || '#71717a',
    bg: style.getPropertyValue('--background').trim() || '#ffffff',
    bgElevated: style.getPropertyValue('--popover').trim() || '#ffffff',
    border: style.getPropertyValue('--border').trim() || '#e4e4e7',
    primary: style.getPropertyValue('--primary').trim() || '#18a058',
    primaryReadable: style.getPropertyValue('--primary').trim() || '#166534',
    radius: style.getPropertyValue('--radius').trim() || '8px',
    borderWidth: style.getPropertyValue('--border-width').trim() || '1px',
    borderStyle: style.getPropertyValue('--border-style').trim() || 'solid',
    shadow: style.getPropertyValue('--ui-shadow').trim() || 'none',
    colorScheme: style.colorScheme || 'light',
  }
  if (
    Object.keys(nextTheme).some(
      (key) => nextTheme[key as keyof CustomHtmlTheme] !== detectedTheme.value[key as keyof CustomHtmlTheme],
    )
  ) {
    detectedTheme.value = nextTheme
  }
  themeReady.value = true
  initialTheme.value ??= nextTheme
}

function connectBridge() {
  cancelPending()
  detachBridge?.()
  detachBridge = frame.value
    ? attachCustomHtmlBridge({
        frame: frame.value,
        channelId: documentResult.value.channelId,
        handlers: handlers.value,
        onHeight: (height) => {
          contentHeight.value = height
        },
        onError: (error) => {
          runtimeError.value = error
        },
      })
    : null
}

watch(
  () => documentResult.value.srcdoc,
  () => {
    contentHeight.value = CUSTOM_HTML_MIN_AUTO_HEIGHT
    runtimeError.value = ''
  },
)
watch(() => [frame.value, documentResult.value.channelId, handlers.value], connectBridge, { flush: 'post' })
watch(sdkTheme, (theme) => detachBridge?.emitThemeChange(theme))
watch(
  () => [props.userInfo, props.biliInfo, props.pageSlug],
  () => {
    const getContext = handlers.value.getContext
    if (getContext) detachBridge?.emitContextChange(getContext(undefined))
  },
  { deep: true },
)

onMounted(() => {
  readTheme()
  connectBridge()
  themeObserver = new MutationObserver(readTheme)
  for (let element = host.value; element; element = element.parentElement) {
    themeObserver.observe(element, { attributes: true, attributeFilter: ['class', 'style'] })
  }
})

onBeforeUnmount(() => {
  cancelPending()
  themeObserver?.disconnect()
  detachBridge?.()
})
</script>

<template>
  <BlockCard
    :framed="config.framed"
    :backgrounded="config.backgrounded"
    :content-style="{ padding: 0, overflow: 'hidden' }"
  >
    <div
      ref="host"
      class="@container w-full min-w-0 [&_iframe]:block [&_iframe]:w-full [&_iframe]:min-h-20 [&_iframe]:border-0 [&_iframe]:bg-transparent"
    >
      <div
        v-if="runtimeError || compileError"
        role="alert"
        class="p-4 text-destructive"
      >
        自定义代码执行失败：{{ runtimeError || compileError }}
      </div>
      <iframe
        v-if="themeReady && documentResult.srcdoc"
        ref="frame"
        :srcdoc="documentResult.srcdoc"
        :style="{ height: `${iframeHeight}px`, minHeight: config.heightMode === 'viewport' ? '100dvh' : undefined }"
        title="自定义内容"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        loading="lazy"
        @load="connectBridge"
      />
    </div>
  </BlockCard>
  <CustomHtmlHostDialogs
    :dialog="dialog"
    :user-info="userInfo"
  />
</template>
