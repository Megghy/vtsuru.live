<script setup lang="ts">
import { TURNSTILE_KEY } from '@/data/constants'
import { onUnmounted, ref } from 'vue'
import { onMounted } from 'vue'

import VueTurnstile from 'vue-turnstile'
const turnstile = ref()

const token = defineModel<string>('token', {
  default: '',
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
  <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
</template>
