<script setup lang="ts">
import { ref, watch } from 'vue'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import { setFollowing } from '@/api/following'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

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
  <Button
    v-if="ACCOUNT.id !== userId"
    size="sm"
    :variant="following ? 'outline' : 'default'"
    class="h-7 text-xs px-2.5"
    :disabled="following === undefined || busy"
    @click.stop="toggle"
  >
    {{ following ? '已关注 · 取消' : '关注' }}<template v-if="followers !== undefined"> · {{ followers }}</template>
  </Button>

  <Dialog v-model:open="showLogin">
    <DialogContent class="sm:max-w-md p-4 space-y-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold">登录后关注</DialogTitle>
      </DialogHeader>
      <RegisterAndLogin />
    </DialogContent>
  </Dialog>
</template>
