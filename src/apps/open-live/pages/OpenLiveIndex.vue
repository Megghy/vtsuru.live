<script setup lang="ts">
import type { OpenLiveInfo } from '@/api/api-models'
import { NAlert, NButton, NCard, NFlex, NGi, NGrid, NText } from 'naive-ui';
import { useAccount } from '@/api/account'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()

const accountInfo = useAccount()
</script>

<template>
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <OpenLivePageHeader
        title="开放平台"
        description="弹幕抽奖、点歌、排队与读弹幕（基于开放平台连接）"
      />
    </NCard>

    <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="12" :y-gap="12">
      <NGi>
        <NCard hoverable bordered size="small" title="弹幕抽奖">
          <NText depth="3">
            通过弹幕或礼物收集用户并抽取，支持多种条件与动画效果。
          </NText>
          <template #footer>
            <NButton
              type="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-lottery', query: $route.query })"
            >
              前往使用
            </NButton>
          </template>
        </NCard>
      </NGi>
      <NGi>
        <NCard hoverable bordered size="small" title="弹幕点播">
          <NText depth="3">
            通过弹幕或 SC 点歌/点播，登录后可保存配置并支持 OBS 展示。
          </NText>
          <template #footer>
            <NButton
              type="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-live-request', query: $route.query })"
            >
              前往使用
            </NButton>
          </template>
        </NCard>
      </NGi>
      <NGi>
        <NCard hoverable bordered size="small" title="弹幕排队">
          <NText depth="3">
            通过弹幕或礼物加入队列，支持过滤条件、排序策略与冷却控制。
          </NText>
          <template #footer>
            <NButton
              type="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-queue', query: $route.query })"
            >
              前往使用
            </NButton>
          </template>
        </NCard>
      </NGi>
      <NGi>
        <NCard hoverable bordered size="small" title="读弹幕">
          <NText depth="3">
            使用浏览器 TTS 朗读弹幕（推荐 Chrome/Edge 等现代浏览器）。
          </NText>
          <template #footer>
            <NButton
              type="primary"
              size="small"
              block
              @click="$router.push({ name: 'open-live-speech', query: $route.query })"
            >
              前往使用
            </NButton>
          </template>
        </NCard>
      </NGi>
    </NGrid>

    <NAlert
      v-if="accountInfo?.eventFetcherState?.online !== true"
      type="warning"
      title="可用性提醒"
      size="small"
      :bordered="false"
    >
      当浏览器在后台运行时，计时器和 WebSocket 连接会受到严格限制，可能导致弹幕接收不稳定（详见
      <NButton
        text
        tag="a"
        href="https://developer.chrome.com/blog/background_tabs/"
        target="_blank"
        type="info"
      >
        此文章
      </NButton>）。
      建议注册并部署
      <NButton
        type="primary"
        text
        size="tiny"
        tag="a"
        href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
      >
        VtsuruEventFetcher
      </NButton>。
    </NAlert>

    <NCard size="small" bordered>
      <OpenLivePageHeader title="还有更多">
        <template #description>
          <NText depth="3">
            舰长积分、动态抽奖、视频征集、歌单、棉花糖、日程表...
          </NText>
        </template>
        <template #actions>
          <NButton text tag="a" href="/" target="_blank" type="primary" size="small">
            VTsuru.live
          </NButton>
          <NButton text tag="a" href="/about" target="_blank" type="info" size="small">
            关于本站
          </NButton>
        </template>
      </OpenLivePageHeader>
    </NCard>
  </NFlex>
</template>
