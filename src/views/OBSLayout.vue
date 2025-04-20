<script setup lang="ts">
import { NSpin } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'

const timer = ref<any>()
const visible = ref(true)
const active = ref(true)

const originalBackgroundColor = ref('')
onMounted(() => {
  timer.value = setInterval(() => {
    if (!visible.value || !active.value) return
    window.$mitt.emit('onOBSComponentUpdate')
  }, 1000)

  //@ts-expect-error 这里获取不了
  if (window.obsstudio) {
    //@ts-expect-error 这里获取不了
    window.obsstudio.onVisibilityChange = function (visibility: boolean) {
      visible.value = visibility
    }
    //@ts-expect-error 这里获取不了
    window.obsstudio.onActiveChange = function (a: boolean) {
      active.value = a
    }
  }
  // 使 .n-layout-content 背景透明
  const layoutContent = document.querySelector('.n-layout-content');
  if (layoutContent instanceof HTMLElement) {
    originalBackgroundColor.value = layoutContent.style.backgroundColor
    layoutContent.style.setProperty('background-color', 'transparent');
  }
})

onUnmounted(() => {
  clearInterval(timer.value)
  // 还原 .n-layout-content 背景颜色
  const layoutContent = document.querySelector('.n-layout-content');
  if (layoutContent instanceof HTMLElement) {
    layoutContent.style.setProperty('background-color', originalBackgroundColor.value);
  }
})
</script>

<template>
  <div style="height: 100vh;">
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <Suspense>
          <component
            :is="Component"
            :active
            :visible
          />
          <template #fallback>
            <NSpin show />
          </template>
        </Suspense>
      </KeepAlive>
    </RouterView>
  </div>
</template>
