<script setup lang="ts">
import { NSpin } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'

const timer = ref<any>()
const visible = ref(true)
const active = ref(true)
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
})
onUnmounted(() => {
  clearInterval(timer.value)
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
