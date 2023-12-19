<script lang="ts" setup>
import { isDarkMode } from '@/Utils'
import { UserInfo } from '@/api/api-models'
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
      <NButton type="primary" secondary @click="navigate('https://live.bilibili.com/' + userInfo?.biliRoomId)"> 直播间 </NButton>
    </NSpace>
  </template>
  <template v-else>
    <NSpace justify="center" align="center">
      <NText strong style="font-size: 32px"> {{ userInfo?.name }} </NText>
      未认证
    </NSpace>
  </template>
</template>
