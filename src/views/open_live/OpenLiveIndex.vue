<script setup lang="ts">
import { useAccount } from '@/api/account'
import DanmakuClient, { RoomAuthInfo } from '@/data/DanmakuClient'
import { NAlert, NButton, NCard, NDivider, NSpace } from 'naive-ui'

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
}>()

const accountInfo = useAccount()
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
      通过弹幕或者SC进行点歌, 注册后可以保存和导出 (这个是歌势用的点歌, 不是拿来放歌的那种!)
      <template #footer>
        <NButton @click="$router.push({ name: 'open-live-song-request', query: $route.query })" type="primary"> 前往使用 </NButton>
      </template>
    </NCard>
    <NCard hoverable embedded size="small" title="弹幕排队" style="width: 300px">
      通过发送弹幕或者礼物进行排队, 允许设置多种条件
      <template #footer>
        <NButton @click="$router.push({ name: 'open-live-queue', query: $route.query })" type="primary"> 前往使用 </NButton>
      </template>
    </NCard>
  </NSpace>
  <br />
  <NAlert v-if="accountInfo?.eventFetcherOnline != true" type="warning" title="可用性警告" style="max-width: 600px; margin: 0 auto">
    当浏览器在后台运行时, 定时器和 Websocket 连接将受到严格限制, 这会导致弹幕接收功能无法正常工作 (详见
    <NButton text tag="a" href="https://developer.chrome.com/blog/background_tabs/" target="_blank" type="info">此文章</NButton>), 虽然本站已经针对此问题做出了处理, 一般情况下即使掉线了也会重连,
    不过还是有可能会遗漏事件
    <br />
    为避免这种情况, 建议注册本站账后使用 <NButton type="primary" text size="tiny" tag="a" href="https://www.yuque.com/megghy/dez70g/vfvcyv3024xvaa1p" target="_blank"> VtsuruEventFetcher </NButton>,
    否则请在使用功能时尽量保持网页在前台运行
  </NAlert>
  <NDivider> 还有更多 </NDivider>
  <NSpace justify="center" align="center" vertical>
    动态抽奖、视频征集、歌单、棉花糖、日程表...
    <p>
      详见
      <NButton text tag="a" href="/" target="_blank" type="primary"> VTsuru.live </NButton>

      <NDivider vertical />
      <NButton text tag="a" href="/about" target="_blank" type="info"> 关于本站 </NButton>
    </p>
  </NSpace>
</template>
