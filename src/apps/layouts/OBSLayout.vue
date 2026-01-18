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

const originalBackgroundColor = ref('')
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
  // 使 .n-layout-content 背景透明
  const layoutContent = document.querySelector('.n-layout-content')
  if (layoutContent instanceof HTMLElement) {
    originalBackgroundColor.value = layoutContent.style.backgroundColor
    layoutContent.style.setProperty('background-color', 'transparent')
  }
})

onUnmounted(() => {
  clearInterval(timer.value)
  // 还原 .n-layout-content 背景颜色
  const layoutContent = document.querySelector('.n-layout-content')
  if (layoutContent instanceof HTMLElement) {
    layoutContent.style.setProperty('background-color', originalBackgroundColor.value)
  }
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
