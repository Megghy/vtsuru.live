<script setup lang="ts">
import { NSpin, useDialog, useLoadingBar, useMessage, useModal, useNotification } from 'naive-ui'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { cookie, useAccount } from '@/api/account'

import { useLoadingBarStore } from '@/store/useLoadingBarStore'

const accountInfo = useAccount()

// Setup code
onMounted(() => {
  window.$loadingBar = useLoadingBar()
  window.$message = useMessage()
  window.$route = useRoute()
  window.$modal = useModal()
  window.$notification = useNotification()
  window.$dialog = useDialog()
  const providerStore = useLoadingBarStore()
  providerStore.setLoadingBar(window.$loadingBar)
})
</script>

<template>
  <NSpin
    v-if="($route.query.token || cookie) && accountInfo.id < 1"
    style="margin: 0 auto;"
  />
  <div
    v-else
    style="height: 100vh"
  >
    <slot />
  </div>
</template>
