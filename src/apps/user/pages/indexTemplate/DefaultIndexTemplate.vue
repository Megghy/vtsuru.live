<script lang="ts" setup>
import type { ResponseUserIndexModel, UserInfo } from '@/api/api-models'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { NAvatar, NButton, NCard, NDivider, NFlex, NSpace, NText, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
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
const message = useMessage()
const accountInfo = useAccount()

const indexInfo = ref<ResponseUserIndexModel>((await getIndexInfo()) || ({} as ResponseUserIndexModel))
// 计算链接顺序（如果后端未提供 linkOrder 则使用对象键顺序）
const orderedLinks = computed(() => {
  if (!indexInfo.value) return [] as [string, string][]
  const entries = Object.entries(indexInfo.value.links || {})
  if (!indexInfo.value.links) return []
  const order = (accountInfo.value?.settings?.index?.linkOrder?.length
    ? accountInfo.value.settings.index.linkOrder
    : (indexInfo.value as any)?.linkOrder) as string[] | undefined
  if (order && order.length) {
    const map = new Map(entries)
    return order.filter(k => map.has(k)).map(k => [k, map.get(k)!]) as [string, string][]
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
      message?.error(`无法获取数据: ${data.message}`)
      return undefined
    }
  } catch (err) {
    message?.error(`无法获取数据: ${err}`)
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
  <NDivider />
  <template v-if="userInfo?.biliId">
    <template v-if="userInfo?.id === accountInfo?.id">
      <NButton
        type="primary"
        @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'index' } })"
      >
        自定义个人主页
      </NButton>
      <NDivider />
    </template>
    <template v-if="indexInfo?.notification">
      <NCard
        size="small"
        content-style="text-align: center"
      >
        {{ indexInfo?.notification }}
      </NCard>
      <br>
    </template>

    <NSpace
      justify="center"
      align="center"
      vertical
    >
      <NAvatar
        v-if="userInfo.streamerInfo"
        :src="userInfo.streamerInfo.faceUrl"
        :size="width > 750 ? 175 : 100"
        round
        bordered
        :img-props="{
          referrerpolicy: 'no-referrer',
        }"
        :style="{ boxShadow: isDarkMode ? 'rgb(195 192 192 / 35%) 0px 5px 20px' : '0 5px 15px rgba(0, 0, 0, 0.2)' }"
      />
      <NSpace
        align="baseline"
        justify="center"
      >
        <NText
          strong
          style="font-size: 32px"
        >
          {{ userInfo?.name }}
        </NText>
        <NText
          strong
          style="font-size: 20px"
          depth="3"
        >
          ({{ userInfo?.streamerInfo?.name }})
        </NText>
      </NSpace>
      <NText
        strong
        depth="3"
        style="font-size: 16px"
      >
        UID: {{ userInfo.streamerInfo?.uId }}
      </NText>
      <NText
        strong
        depth="2"
        style="font-size: medium"
      >
        {{ biliInfo?.sign }}
      </NText>
    </NSpace>
    <NDivider />
    <NSpace
      align="center"
      justify="center"
    >
      <NButton
        type="primary"
        @click="navigate(`https://space.bilibili.com/${userInfo?.biliId}`)"
      >
        个人主页
      </NButton>
      <NButton
        type="primary"
        secondary
        @click="navigate(`https://live.bilibili.com/${userInfo?.biliRoomId}`)"
      >
        直播间
      </NButton>
    </NSpace>
    <template v-if="orderedLinks.length > 0">
      <NDivider> 相关链接 </NDivider>
      <NFlex
        justify="center"
        wrap
      >
        <NButton
          v-for="link in orderedLinks"
          :key="link[0] + link[1]"
          size="small"
          type="info"
          secondary
          tag="a"
          :href="link[1]"
          target="_blank"
          style="margin:4px"
        >
          {{ link[0] }}
        </NButton>
      </NFlex>
    </template>
    <template v-if="indexInfo.videos?.length || 0 > 0">
      <NDivider>
        <NText style="font-size:18px">
          相关视频
        </NText>
      </NDivider>
      <NFlex justify="center">
        <SimpleVideoCard
          v-for="video in indexInfo.videos"
          :key="video.id"
          :video="video"
        />
      </NFlex>
    </template>
  </template>
  <template v-else>
    <NSpace
      justify="center"
      align="center"
    >
      <NText
        strong
        style="font-size: 32px"
      >
        {{ userInfo?.name }}
      </NText>
      未认证
    </NSpace>
  </template>
</template>
