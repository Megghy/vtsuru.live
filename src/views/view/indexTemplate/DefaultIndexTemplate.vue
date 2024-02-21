<script lang="ts" setup>
import { isDarkMode } from '@/Utils'
import { UserInfo } from '@/api/api-models'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { NAvatar, NButton, NDivider, NSpace, NText } from 'naive-ui'

const width = window.innerWidth

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  currentData?: any
}>()
function navigate(url: string) {
  window.open(url, '_blank')
}
defineExpose({ Config, DefaultConfig })
</script>

<script lang="ts">
export type ConfigType = {
  cover: string
}
export const DefaultConfig = {} as ConfigType
export const Config: TemplateConfig<ConfigType> = {
  name: 'Template.Index.Simple',
  items: [
    {
      name: '封面',
      type: 'image',
      imageLimit: 1,
      onUploaded: (url, config) => {
        config.cover = url instanceof String ? (url as string) : url[0]
      },
    },
    {
      name: 'test',
      type: 'string',
      data: {
        get: (d) => d.cover,
        set: (d, v) => {
          d.cover = v
        },
      },
    },
  ],
}
</script>

<template>
  <NDivider />
  <template v-if="userInfo?.biliId">
    <NSpace justify="center" align="center" vertical>
      <NAvatar
        v-if="biliInfo"
        :src="biliInfo?.face"
        :size="width > 750 ? 175 : 100"
        round
        bordered
        :img-props="{
          referrerpolicy: 'no-referrer',
        }"
        :style="{ boxShadow: isDarkMode() ? 'rgb(195 192 192 / 35%) 0px 5px 20px' : '0 5px 15px rgba(0, 0, 0, 0.2)' }"
      />
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
    </NSpace>
  </template>
  <template v-else>
    <NSpace justify="center" align="center">
      <NText strong style="font-size: 32px"> {{ userInfo?.name }} </NText>
      未认证
    </NSpace>
  </template>
</template>
