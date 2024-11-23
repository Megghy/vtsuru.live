<script lang="ts" setup>
import { isDarkMode } from '@/Utils'
import { useAccount } from '@/api/account'
import { ResponseUserIndexModel, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { USER_INDEX_API_URL } from '@/data/constants'
import { NAlert, NAvatar, NButton, NCard, NDivider, NFlex, NSpace, NText, useMessage } from 'naive-ui'
import { ref } from 'vue'

defineExpose({ Config, DefaultConfig })
const width = window.innerWidth

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  currentData?: any
}>()
const isLoading = ref(true)
const message = useMessage()
const accountInfo = useAccount()

const indexInfo = ref<ResponseUserIndexModel>((await getIndexInfo()) || ({} as ResponseUserIndexModel))
async function getIndexInfo() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponseUserIndexModel>(USER_INDEX_API_URL + 'get', { id: props.userInfo?.name })
    if (data.code == 200) {
      return data.data
    } else if (data.code != 404) {
      message?.error('无法获取数据: ' + data.message)
      return undefined
    }
  } catch (err) {
    message?.error('无法获取数据: ' + err)
    return undefined
  } finally {
    isLoading.value = false
  }
}

function navigate(url: string) {
  window.open(url, '_blank')
}
</script>

<script lang="ts">
export type ConfigType = {
  test: string
}
export const DefaultConfig = {} as ConfigType
export const Config: TemplateConfig<ConfigType> = {
  name: 'Template.Index.Simple',
  items: [
    {
      name: '封面',
      type: 'image',
      imageLimit: 1,
      key: 'cover',
    },
    {
      name: '测试',
      type: 'string',
      key: 'test',
    },
  ],
}
</script>

<template>
  <NDivider />
  <template v-if="userInfo?.biliId">
    <template v-if="userInfo?.id == accountInfo?.id">
      <NButton type="primary"
        @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'index' } })">
        自定义个人主页
      </NButton>
      <NDivider />
    </template>
    <template v-if="indexInfo?.notification">
      <NCard size="small" content-style="text-align: center">
        {{ indexInfo?.notification }}
      </NCard>
      <br />
    </template>

    <NSpace justify="center" align="center" vertical>
      <NAvatar v-if="biliInfo" :src="biliInfo?.face" :size="width > 750 ? 175 : 100" round bordered :img-props="{
        referrerpolicy: 'no-referrer',
      }"
        :style="{ boxShadow: isDarkMode ? 'rgb(195 192 192 / 35%) 0px 5px 20px' : '0 5px 15px rgba(0, 0, 0, 0.2)' }" />
      <NSpace align="baseline" justify="center">
        <NText strong style="font-size: 32px"> {{ biliInfo?.name }} </NText>
        <NText strong style="font-size: 20px" depth="3"> ({{ userInfo?.name }}) </NText>
      </NSpace>
      <NText strong depth="3" style="font-size: medium">
        {{ userInfo?.biliId }}
      </NText>
      <NText strong depth="2" style="font-size: medium">
        {{ biliInfo?.sign }}
      </NText>
    </NSpace>
    <NDivider />
    <NSpace align="center" justify="center">
      <NButton type="primary" @click="navigate('https://space.bilibili.com/' + userInfo?.biliId)"> 个人主页 </NButton>
      <NButton type="primary" secondary @click="navigate('https://live.bilibili.com/' + userInfo?.biliRoomId)">
        直播间
      </NButton>
      <temlate v-if="Object.keys(indexInfo.links || {}).length > 0">
        <NFlex align="center">
          <NDivider vertical />
          <NButton type="info" secondary tag="a" :href="link[1]" target="_blank"
            v-for="link in Object.entries(indexInfo.links || {})" :key="link[0] + link[1]">
            {{ link[0] }}
          </NButton>
        </NFlex>
      </temlate>
    </NSpace>
    <template v-if="indexInfo.videos?.length || 0 > 0">
      <NDivider>
        <NText>相关视频</NText>
      </NDivider>
      <NFlex justify="center">
        <SimpleVideoCard v-for="video in indexInfo.videos" :video="video" :key="video.id" />
      </NFlex>
    </template>
  </template>
  <template v-else>
    <NSpace justify="center" align="center">
      <NText strong style="font-size: 32px"> {{ userInfo?.name }} </NText>
      未认证
    </NSpace>
  </template>
</template>
