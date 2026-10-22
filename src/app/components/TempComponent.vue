<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { useDialog, useLoadingBar, useMessage, useNotification } from '@/shared/utils'
import { useLoadingBarStore } from '@/store/useLoadingBarStore'

const accountInfo = useAccount()

// Setup code
onMounted(() => {
  window.$loadingBar = useLoadingBar()
  window.$message = useMessage()
  window.$route = useRoute()
  window.$notification = useNotification()
  window.$dialog = useDialog()
  const providerStore = useLoadingBarStore()
  providerStore.setLoadingBar(window.$loadingBar)
})
</script>

<template>
  <div
    v-if="($route.query.token || cookie) && accountInfo.id < 1"
    class="flex items-center justify-center min-h-screen w-full"
  >
    <div class="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
  <slot v-else />
</template>
