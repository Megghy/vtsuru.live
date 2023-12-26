<script setup lang="ts">
import { useProviderStore } from '@/store/useProviderStore'
import { useLoadingBar } from 'naive-ui'
import { onMounted } from 'vue'

// Setup code
onMounted(() => {
  const providerStore = useProviderStore()
  const loadingBar = useLoadingBar()
  providerStore.setLoadingBar(loadingBar)
})
</script>

<template>
  <div style="height: 100vh">
    <slot></slot>
  </div>
</template>
