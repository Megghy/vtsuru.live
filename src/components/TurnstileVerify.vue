<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

import VueTurnstile from 'vue-turnstile'
import { TURNSTILE_KEY } from '@/data/constants'

import { isDarkMode } from '@/Utils'

const turnstile = ref()

const token = defineModel<string>('token', {
  default: '',
})

// Set theme based on dark mode status
const theme = computed(() => {
  return isDarkMode ? 'dark' : 'light'
})
onUnmounted(() => {
  turnstile.value?.remove()
})

defineExpose({
  reset,
})

function reset() {
  turnstile.value?.reset()
}
</script>

<template>
  <VueTurnstile
    ref="turnstile"
    v-model="token"
    :site-key="TURNSTILE_KEY"
    :theme="theme"
    style="text-align: center"
  />
</template>
