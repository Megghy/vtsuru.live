<script setup lang="ts">
import { useAccount } from '@/api/account'
import type { OpenLiveInfo } from '@/api/api-models'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()

const accountInfo = useAccount()
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <UCard
      size="small"
      bordered
    >
      <OpenLivePageHeader
        title="开放平台"
        description="弹幕抽奖、点歌、排队与读弹幕（基于开放平台连接）"
      />
    </UCard>

    <div
      cols="1 s:2 l:4"
      responsive="screen"
      :x-gap="12"
      :y-gap="12"
    >
      <div>
        <UCard
          hoverable
          bordered
          size="small"
          title="弹幕抽奖"
        >
          <span depth="3"> 通过弹幕或礼物收集用户并抽取，支持多种条件与动画效果。 </span>
          <template #footer>
            <UButton
              color="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-lottery', query: $route.query })"
            >
              前往使用
            </UButton>
          </template>
        </UCard>
      </div>
      <div>
        <UCard
          hoverable
          bordered
          size="small"
          title="弹幕点播"
        >
          <span depth="3"> 通过弹幕或 SC 点歌/点播，登录后可保存配置并支持 OBS 展示。 </span>
          <template #footer>
            <UButton
              color="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-live-request', query: $route.query })"
            >
              前往使用
            </UButton>
          </template>
        </UCard>
      </div>
      <div>
        <UCard
          hoverable
          bordered
          size="small"
          title="弹幕排队"
        >
          <span depth="3"> 通过弹幕或礼物加入队列，支持过滤条件、排序策略与冷却控制。 </span>
          <template #footer>
            <UButton
              color="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-queue', query: $route.query })"
            >
              前往使用
            </UButton>
          </template>
        </UCard>
      </div>
      <div>
        <UCard
          hoverable
          bordered
          size="small"
          title="读弹幕"
        >
          <span depth="3"> 使用浏览器 TTS 朗读弹幕（推荐 Chrome/Edge 等现代浏览器）。 </span>
          <template #footer>
            <UButton
              color="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-speech', query: $route.query })"
            >
              前往使用
            </UButton>
          </template>
        </UCard>
      </div>
    </div>

    <UAlert
      v-if="accountInfo?.eventFetcherState?.online !== true"
      type="warning"
      title="可用性提醒"
      size="small"
      :bordered="false"
    >
      当浏览器在后台运行时，计时器和 WebSocket 连接会受到严格限制，可能导致弹幕接收不稳定（详见
      <UButton
        variant="link"
        tag="a"
        href="https://developer.chrome.com/blog/background_tabs/"
        target="_blank"
        color="info"
      >
        此文章 </UButton
      >）。 建议注册并部署
      <UButton
        color="primary"
        variant="link"
        size="tiny"
        tag="a"
        href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
      >
        VtsuruEventFetcher </UButton
      >。
    </UAlert>

    <UCard
      size="small"
      bordered
    >
      <OpenLivePageHeader title="还有更多">
        <template #description>
          <span depth="3"> 舰长积分、动态抽奖、视频征集、歌单、棉花糖、日程表... </span>
        </template>
        <template #footers>
          <UButton
            variant="link"
            tag="a"
            href="/"
            target="_blank"
            color="primary"
            size="small"
          >
            VTsuru.live
          </UButton>
          <UButton
            variant="link"
            tag="a"
            href="/about"
            target="_blank"
            color="info"
            size="small"
          >
            关于本站
          </UButton>
        </template>
      </OpenLivePageHeader>
    </UCard>
  </div>
</template>
