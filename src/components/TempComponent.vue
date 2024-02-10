<script setup lang="ts">
import { useLoadingBarStore } from '@/store/useLoadingBarStore'
import { useLoadingBar } from 'naive-ui'
import { onMounted } from 'vue'

// Setup code
onMounted(() => {
  const providerStore = useLoadingBarStore()
  const loadingBar = useLoadingBar()
  providerStore.setLoadingBar(loadingBar)
})
</script>

<template>
  <div style="height: 100vh">
    <slot></slot>
  </div>
</template>
