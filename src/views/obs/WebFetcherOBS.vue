<script setup lang="ts">
import { useWebFetcher } from '@/store/useWebFetcher'
import { onMounted, onUnmounted, ref } from 'vue'

const webFetcher = useWebFetcher()

let timer: any
onMounted(async () => {
  await webFetcher.Start()
  setTimeout(() => {
    // @ts-expect-error obs的东西
    if (!webFetcher.isStarted && window.obsstudio) {
      timer = setInterval(() => {
        if (webFetcher.isStarted) {
          return
        }

        webFetcher.Stop()
        webFetcher.Start()
      }, 20000)
    }
  }, 10000)
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div
    class="web-fetcher-status"
    :style="{
      backgroundColor: webFetcher.isStarted ? '#6dc56d' : '#e34a4a',
    }"
  ></div>
</template>

<style scoped>
.web-fetcher-status {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.2);
  border: 3px solid #00000033;
  animation: animated-border 3s infinite;
  transition: background-color 0.5s;
}
@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}
</style>
