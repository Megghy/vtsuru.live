<script setup lang="ts">
import { loadingBarState } from '@/shared/utils'
</script>

<template>
  <div
    v-if="loadingBarState.active"
    class="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5 overflow-hidden bg-transparent"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(loadingBarState.progress)"
  >
    <div
      class="h-full transition-[width,opacity] duration-200 ease-out"
      :class="loadingBarState.status === 'error' ? 'bg-destructive' : 'bg-primary'"
      :style="{ width: `${Math.min(100, Math.max(0, loadingBarState.progress))}%` }"
    />
  </div>
</template>
