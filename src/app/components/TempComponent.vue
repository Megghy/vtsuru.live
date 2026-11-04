<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { useDialog, useLoadingBar, useMessage, useNotification } from '@/shared/utils'
import { Spin } from '@/shared/ui/spin'
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
    class="flex-center min-h-screen w-full"
  >
    <Spin size="large" />
  </div>
  <slot v-else />
</template>
