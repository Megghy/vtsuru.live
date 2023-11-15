<script setup lang="ts">
import DanmakuClient, { RoomAuthInfo } from '@/data/DanmakuClient';
import { NButton, NCard, NDivider, NSpace } from 'naive-ui'

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
}>()
</script>

<template>
  <NDivider> 功能 </NDivider>
  <NSpace justify="center">
    <NCard hoverable embedded size="small" title="弹幕抽奖" style="width: 300px">
      通过弹幕或者礼物收集用户, 并进行抽取, 允许设置多种条件
      <template #footer>
        <NButton @click="$router.push({ name: 'open-live-lottery', query: $route.query })" type="primary"> 前往使用 </NButton>
      </template>
    </NCard>
    <NCard hoverable embedded size="small" title="弹幕点歌" style="width: 300px">
      通过弹幕或者SC进行点歌, 注册后可以保存和导出 (开发中
      <template #footer>
        <NButton @click="$router.push({ name: 'open-live-song-request', query: $route.query })" type="primary"> 前往使用 </NButton>
      </template>
    </NCard>
  </NSpace>
  <NDivider> 还有更多 </NDivider>
  <NSpace justify="center" align="center" vertical>
    动态抽奖、视频征集、歌单、棉花糖、日程表...
    <p>
      详见
      <NButton text tag="a" href="/" target="_blank" type="primary"> VTsuru.live </NButton>
    </p>
  </NSpace>
</template>
