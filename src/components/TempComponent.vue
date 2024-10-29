<script setup lang="ts">
import { useLoadingBarStore } from '@/store/useLoadingBarStore'
import { useLoadingBar, useMessage } from 'naive-ui'
import { onMounted } from 'vue'

// Setup code
onMounted(() => {
  window.$loadingBar = useLoadingBar()
  window.$message = useMessage()
  const providerStore = useLoadingBarStore()
  providerStore.setLoadingBar(window.$loadingBar)
})
</script>

<template>
  <div style="height: 100vh">
    <slot></slot>
  </div>
</template>
