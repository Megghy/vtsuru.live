<script setup lang="ts">
import { NButton, NModal } from 'naive-ui'
import { ref, watch } from 'vue'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import { setFollowing } from '@/api/following'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'

const props = defineProps<{ userId: number; following: boolean | undefined; followers?: number }>()
const emit = defineEmits<{ changed: [following: boolean] }>()
const busy = ref(false)
const showLogin = ref(false)
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) showLogin.value = false
})
async function toggle() {
  if (!isLoggedIn.value) {
    showLogin.value = true
    return
  }
  busy.value = true
  try {
    const value = !props.following
    await setFollowing(props.userId, value)
    emit('changed', value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <NButton
    v-if="ACCOUNT.id !== userId"
    size="small"
    :type="following ? 'default' : 'primary'"
    secondary
    :loading="busy"
    :disabled="following === undefined"
    @click.stop="toggle"
  >
    {{ following ? '已关注 · 取消' : '关注' }}<template v-if="followers !== undefined"> · {{ followers }}</template>
  </NButton>
  <NModal
    v-model:show="showLogin"
    preset="card"
    title="登录后关注"
    style="width: min(420px, 92vw)"
  >
    <RegisterAndLogin />
  </NModal>
</template>
