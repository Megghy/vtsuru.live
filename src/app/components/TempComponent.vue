<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { useLoadingBarStore } from '@/store/useLoadingBarStore'
import { useDialog, useLoadingBar, useMessage, useModal, useNotification } from '@/shared/utils'

const accountInfo = useAccount()

// Setup code
onMounted(() => {
  ;(window as any).$loadingBar = useLoadingBar()
  ;(window as any).$message = useMessage()
  ;(window as any).$route = useRoute()
  ;(window as any).$modal = useModal()
  ;(window as any).$notification = useNotification()
  ;(window as any).$dialog = useDialog()
  const providerStore = useLoadingBarStore()
  providerStore.setLoadingBar((window as any).$loadingBar)
})
</script>

<template>
  <div
    v-if="($route.query.token || cookie) && accountInfo.id < 1"
    class="flex items-center justify-center min-h-screen w-full"
  >
    <div class="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
  <div
    v-else
    class="h-screen w-full"
  >
    <slot />
  </div>
</template>
