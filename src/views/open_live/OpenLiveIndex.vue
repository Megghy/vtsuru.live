<script setup lang="ts">
import { useAccount } from '@/api/account';
import { OpenLiveInfo } from '@/api/api-models';
import { NAlert, NButton, NCard, NDivider, NSpace } from 'naive-ui';

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()

const accountInfo = useAccount()
</script>

<template>
  <NDivider> 功能 </NDivider>
  <NSpace
    justify="center"
    :size="[20, 20]"
    item-style="display: flex;"
  >
    <NCard
      hoverable
      bordered
      size="small"
      title="弹幕抽奖"
      style="width: 300px; flex-grow: 1;"
    >
      通过弹幕或者礼物收集用户, 并进行抽取, 允许设置多种条件
      <template #footer>
        <NButton
          type="primary"
          @click="$router.push({ name: 'open-live-lottery', query: $route.query })"
        >
          前往使用
        </NButton>
      </template>
    </NCard>
    <NCard
      hoverable
      bordered
      size="small"
      title="弹幕点播"
      style="width: 300px; flex-grow: 1;"
    >
      通过弹幕或者SC进行点歌或者其他的点播(比如跳舞或者点播视频之类的), 注册后可以保存和导出
      <template #footer>
        <NButton
          type="primary"
          @click="$router.push({ name: 'open-live-live-request', query: $route.query })"
        >
          前往使用
        </NButton>
      </template>
    </NCard>
    <NCard
      hoverable
      bordered
      size="small"
      title="弹幕排队"
      style="width: 300px; flex-grow: 1;"
    >
      通过发送弹幕或者礼物进行排队, 允许设置多种条件
      <template #footer>
        <NButton
          type="primary"
          @click="$router.push({ name: 'open-live-queue', query: $route.query })"
        >
          前往使用
        </NButton>
      </template>
    </NCard>

    <NCard
      hoverable
      bordered
      size="small"
      title="读弹幕"
      style="width: 300px; flex-grow: 1;"
    >
      通过浏览器自带的tts服务读弹幕 (此功能需要 Chrome, Edge 等现代浏览器!)
      <template #footer>
        <NButton
          type="primary"
          @click="$router.push({ name: 'open-live-speech', query: $route.query })"
        >
          前往使用
        </NButton>
      </template>
    </NCard>
  </NSpace>
  <br>
  <br>
  <NSpace
    v-if="accountInfo?.eventFetcherState?.online != true"
    justify="center"
  >
    <NAlert
      type="warning"
      title="可用性警告"
      style="max-width: 600px; margin: 0 auto"
    >
      当浏览器在后台运行时, 定时器和 Websocket 连接将受到严格限制, 这会导致弹幕接收功能无法正常工作 (详见
      <NButton
        text
        tag="a"
        href="https://developer.chrome.com/blog/background_tabs/"
        target="_blank"
        type="info"
      >
        此文章
      </NButton>), 虽然本站已经针对此问题做出了处理, 一般情况下即使掉线了也会重连, 不过还是有可能会遗漏事件
      <br>
      为避免这种情况, 建议注册本站账后使用
      <NButton
        type="primary"
        text
        size="tiny"
        tag="a"
        href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
      >
        VtsuruEventFetcher
      </NButton>, 否则请在使用功能时尽量保持网页在前台运行
    </NAlert>
  </NSpace>
  <br v-if="accountInfo?.eventFetcherState?.online != true">
  <NDivider> 还有更多 </NDivider>
  <NSpace
    justify="center"
    align="center"
    vertical
  >
    <p style="font-size: 1.1em; color: var(--n-text-color-2)">
      舰长积分、动态抽奖、视频征集、歌单、棉花糖、日程表...
    </p>
    <p>
      详见
      <NButton
        text
        tag="a"
        href="/"
        target="_blank"
        type="primary"
      >
        VTsuru.live
      </NButton>

      <NDivider vertical />
      <NButton
        text
        tag="a"
        href="/about"
        target="_blank"
        type="info"
      >
        关于本站
      </NButton>
    </p>
  </NSpace>
</template>
