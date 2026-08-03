<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import type { UserBasicInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { USER_API_URL } from '@/shared/config'
import { getUserAvatarUrl } from '@/shared/utils'

const props = defineProps<{
  user: string | number
}>()
const userInfo = defineModel<UserBasicInfo | undefined>('userInfo')

const currentUser = ref<UserBasicInfo>({} as UserBasicInfo)
const isLoading = ref(false)
const deBounce = useDebounceFn((newValue: string | number) => {
  getUserInfo(newValue)
}, 666)

watch(
  () => props.user,
  (newValue) => {
    deBounce(newValue)
  },
)
async function getUserInfo(user: string | number) {
  try {
    if (!props.user) {
      currentUser.value = {} as UserBasicInfo
      return
    }
    isLoading.value = true
    const data = await QueryGetAPI<UserBasicInfo>(`${USER_API_URL}basic/${user}`)
    if (data.code == 200) {
      currentUser.value = data.data
    } else {
      currentUser.value = {} as UserBasicInfo
    }
  } finally {
    isLoading.value = false
    userInfo.value = currentUser.value
  }
}

onMounted(() => {
  getUserInfo(props.user)
})
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div
      v-if="isLoading"
      class="user-basic-info-card__loading"
    >
      <USkeleton class="size-10 rounded-full" />
      <USkeleton class="h-4 w-28" />
    </div>
    <UEmpty
      v-else-if="!currentUser.id"
      :title="user ? '未找到用户' : '未选择用户'"
      size="sm"
    />
    <div
      v-else
      class="user-basic-info-card__content"
    >
      <UAvatar
        :src="getUserAvatarUrl(currentUser.id)"
        :alt="currentUser.name"
        size="md"
      />
      <USeparator orientation="vertical" />
      <strong>{{ currentUser.name }}</strong>
    </div>
  </UCard>
</template>

<style scoped>
.user-basic-info-card__loading,
.user-basic-info-card__content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
}
</style>
