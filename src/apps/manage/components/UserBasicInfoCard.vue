<script setup lang="ts">
import type { UserBasicInfo } from '@/api/api-models'
import { useDebounceFn } from '@vueuse/core'
import { NAvatar, NCard, NDivider, NEmpty, NFlex, NSpin, NText } from 'naive-ui';
import { onMounted, ref, watch } from 'vue'
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
  <NSpin :show="isLoading">
    <NCard size="small">
      <NEmpty
        v-if="!currentUser.id"
        :description="user ? (isLoading ? '加载中' : '未找到用户') : '未选择用户'"
      />
      <NFlex
        v-else
        align="center"
      >
        <NAvatar
          round
          :src="getUserAvatarUrl(currentUser.id)"
          :img-props="{ referrerpolicy: 'no-referrer' }"
        />
        <NDivider vertical />
        <NText>
          {{ currentUser.name }}
        </NText>
      </NFlex>
    </NCard>
  </NSpin>
</template>
