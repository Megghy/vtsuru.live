<script lang="ts" setup>
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseUserIndexModel, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import { isDarkMode } from '@/shared/utils'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  currentData?: any
  config?: any
}>()
defineExpose({ Config, DefaultConfig })
const width = window.innerWidth

const isLoading = ref(true)
const toast = useToast()
const accountInfo = useAccount()

const indexInfo = ref<ResponseUserIndexModel>((await getIndexInfo()) || ({} as ResponseUserIndexModel))
// 计算链接顺序（如果后端未提供 linkOrder 则使用对象键顺序）
const orderedLinks = computed(() => {
  if (!indexInfo.value) return [] as [string, string][]
  const entries = Object.entries(indexInfo.value.links || {})
  if (!indexInfo.value.links) return []
  const order = (
    accountInfo.value?.settings?.index?.linkOrder?.length
      ? accountInfo.value.settings.index.linkOrder
      : (indexInfo.value as any)?.linkOrder
  ) as string[] | undefined
  if (order && order.length) {
    const map = new Map(entries)
    return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]) as [string, string][]
  }
  return entries
})
async function getIndexInfo() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponseUserIndexModel>(`${USER_INDEX_API_URL}get`, { id: props.userInfo?.name })
    if (data.code == 200) {
      return data.data
    } else if (data.code != 404) {
      toast.add({ title: `无法获取数据: ${data.message}`, color: 'error' })
      return undefined
    }
  } catch (err) {
    toast.add({ title: `无法获取数据: ${err}`, color: 'error' })
    return undefined
  } finally {
    isLoading.value = false
  }
}

function navigate(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([
  {
    name: '封面',
    type: 'file',
    fileLimit: 1,
    key: 'coverFile',
  },
  {
    name: '测试',
    type: 'string',
    key: 'test',
  },
])
</script>

<template>
  <USeparator />
  <template v-if="userInfo?.biliId">
    <template v-if="userInfo?.id === accountInfo?.id">
      <UButton
        color="primary"
        @click="$router.push({ name: 'manage-userPageBuilder' })"
      >
        自定义个人主页
      </UButton>
      <USeparator />
    </template>
    <template v-if="indexInfo?.notification">
      <UCard
        size="small"
        content-style="text-align: center"
        class="user-page-card"
      >
        {{ indexInfo?.notification }}
      </UCard>
      <br />
    </template>

    <div
      justify="center"
      align="center"
      vertical
    >
      <UAvatar
        v-if="userInfo.streamerInfo"
        :src="userInfo.streamerInfo.faceUrl"
        :size="width > 750 ? 175 : 100"
        :img-props="{
          referrerpolicy: 'no-referrer',
        }"
        :style="{ boxShadow: isDarkMode ? 'rgb(195 192 192 / 35%) 0px 5px 20px' : '0 5px 15px rgba(0, 0, 0, 0.2)' }"
      />
      <div
        align="baseline"
        justify="center"
      >
        <span
          strong
          style="font-size: 32px"
        >
          {{ userInfo?.name }}
        </span>
        <span
          strong
          style="font-size: 20px"
          depth="3"
        >
          ({{ userInfo?.streamerInfo?.name }})
        </span>
      </div>
      <span
        strong
        depth="3"
        style="font-size: 16px"
      >
        UID: {{ userInfo.streamerInfo?.uId }}
      </span>
      <span
        strong
        depth="2"
        style="font-size: medium"
      >
        {{ biliInfo?.sign }}
      </span>
    </div>
    <USeparator />
    <div
      align="center"
      justify="center"
    >
      <UButton
        color="primary"
        @click="navigate(`https://space.bilibili.com/${userInfo?.biliId}`)"
      >
        个人主页
      </UButton>
      <UButton
        color="primary"
        variant="soft"
        @click="navigate(`https://live.bilibili.com/${userInfo?.biliRoomId}`)"
      >
        直播间
      </UButton>
    </div>
    <template v-if="orderedLinks.length > 0">
      <USeparator> 相关链接 </USeparator>
      <div
        justify="center"
        wrap
      >
        <UButton
          v-for="link in orderedLinks"
          :key="link[0] + link[1]"
          size="sm"
          color="info"
          variant="soft"
          :href="link[1]"
          target="_blank"
          style="margin: 4px"
        >
          {{ link[0] }}
        </UButton>
      </div>
    </template>
    <template v-if="indexInfo.videos?.length || 0 > 0">
      <USeparator>
        <span style="font-size: 18px"> 相关视频 </span>
      </USeparator>
      <div justify="center">
        <SimpleVideoCard
          v-for="video in indexInfo.videos"
          :key="video.id"
          :video="video"
        />
      </div>
    </template>
  </template>
  <template v-else>
    <div
      justify="center"
      align="center"
    >
      <span
        strong
        style="font-size: 32px"
      >
        {{ userInfo?.name }}
      </span>
      未认证
    </div>
  </template>
</template>
