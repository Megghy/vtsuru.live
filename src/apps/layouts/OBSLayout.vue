<script setup lang="ts">
import { NSpin } from 'naive-ui';
import { onMounted, onUnmounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { useWebFetcher } from '@/store/useWebFetcher'
import { useOBSNotification } from '@/store/useOBSNotification'

const timer = ref<any>()
const visible = ref(true)
const active = ref(true)
const webfetcher = useWebFetcher()
const accountInfo = useAccount()
const _obsNotification = useOBSNotification()

const code = accountInfo.value.id ? accountInfo.value.biliAuthCode : window.$route.query.code?.toString()

const transparentTargets = [
  () => document.documentElement,
  () => document.body,
  () => document.getElementById('app'),
  () => document.querySelector('.n-layout-content'),
  () => document.querySelector('.n-element'),
  () => document.querySelector('.obs-container'),
] as const

const originalBackgroundStyles = new Map<HTMLElement, { color: string, image: string }>()

function applyTransparentBackgrounds() {
  for (const getElement of transparentTargets) {
    const element = getElement()
    if (!(element instanceof HTMLElement)) continue
    originalBackgroundStyles.set(element, {
      color: element.style.backgroundColor,
      image: element.style.backgroundImage,
    })
    element.style.setProperty('background-color', 'transparent', 'important')
    element.style.setProperty('background-image', 'none', 'important')
  }
}

function restoreTransparentBackgrounds() {
  for (const [element, style] of originalBackgroundStyles) {
    element.style.setProperty('background-color', style.color)
    element.style.setProperty('background-image', style.image)
  }
  originalBackgroundStyles.clear()
}

onMounted(async () => {
  timer.value = setInterval(() => {
    if (!visible.value || !active.value) return
    window.$mitt.emit('onOBSComponentUpdate')
  }, 1000)

  if (accountInfo.value.id) {
    await webfetcher.Start()
  }

  // @ts-expect-error 这里获取不了
  if (window.obsstudio) {
    // @ts-expect-error 这里获取不了
    window.obsstudio.onVisibilityChange = function (visibility: boolean) {
      visible.value = visibility
    }
    // @ts-expect-error 这里获取不了
    window.obsstudio.onActiveChange = function (a: boolean) {
      active.value = a
    }
  }

  applyTransparentBackgrounds()
})

onUnmounted(() => {
  clearInterval(timer.value)
  restoreTransparentBackgrounds()
})
</script>

<template>
  <div class="obs-container">
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <Suspense>
          <component
            :is="Component"
            :active
            :visible
            :code="code"
          />
          <template #fallback>
            <NSpin show />
          </template>
        </Suspense>
      </KeepAlive>
    </RouterView>
  </div>
</template>

<style>
.obs-container {
  --obs-classic-card-bg: rgba(15, 15, 15, 0.16);
  --obs-classic-surface-bg: rgba(15, 15, 15, 0.2);
  --obs-classic-chip-bg: rgba(0, 0, 0, 0.12);
  --obs-classic-footer-bg: rgba(0, 0, 0, 0.16);
  --obs-classic-tag-bg: rgba(255, 255, 255, 0.08);
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* 确保OBS中不出现滚动条 */
body {
  overflow: hidden;
  margin: 0;
  padding: 0;
}
</style>
