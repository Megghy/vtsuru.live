<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import type { UserBasicInfo } from '@/api/api-models'
import { getApiUserBasicValue } from '@/api/generated/user/user'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
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
    const data = (await getApiUserBasicValue(String(user))) as unknown as {
      code: number
      data: UserBasicInfo
    }
    if (data.code === 200) {
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
  <Spin :show="isLoading">
    <Card class="p-3">
      <CardContent class="p-0">
        <Empty
          v-if="!currentUser.id"
          size="small"
          :description="user ? (isLoading ? '加载中' : '未找到用户') : '未选择用户'"
        />
        <div
          v-else
          class="flex items-center gap-3"
        >
          <Avatar class="size-8">
            <AvatarImage
              :src="getUserAvatarUrl(currentUser.id)"
              referrerpolicy="no-referrer"
            />
            <AvatarFallback>{{ currentUser.name?.slice(0, 2) || '用户' }}</AvatarFallback>
          </Avatar>
          <Separator
            orientation="vertical"
            class="h-4"
          />
          <span class="text-xs font-medium text-foreground">
            {{ currentUser.name }}
          </span>
        </div>
      </CardContent>
    </Card>
  </Spin>
</template>
