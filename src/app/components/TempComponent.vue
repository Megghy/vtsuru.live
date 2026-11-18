<script setup lang="ts">
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { useDialog, useLoadingBar, useMessage, useNotification } from '@/shared/utils'
import { Spin } from '@/shared/ui/spin'
import { useLoadingBarStore } from '@/store/useLoadingBarStore'

const accountInfo = useAccount()
const route = useRoute()

// 在父组件 setup 顶层同步注入全局依赖，避免子组件比父组件 onMounted 更早读取时缺失
window.$loadingBar = useLoadingBar()
window.$message = useMessage()
window.$notification = useNotification()
window.$dialog = useDialog()
useLoadingBarStore().setLoadingBar(window.$loadingBar)
</script>

<template>
  <div
    v-if="(route.query.token || cookie) && accountInfo.id < 1"
    class="flex-center min-h-screen w-full"
  >
    <Spin size="large" />
  </div>
  <slot v-else />
</template>
