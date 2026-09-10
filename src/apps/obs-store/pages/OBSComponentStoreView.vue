<script lang="ts" setup>
import { NCard, NFlex, NGrid, NGridItem, NPageHeader, NTag, NText } from 'naive-ui'
import { defineAsyncComponent } from 'vue'

const GamepadViewer = defineAsyncComponent(
  () => import('@/apps/obs-store/components/gamepads/GamepadViewer.vue'),
)

interface ObsQuickEntry {
  id: string
  name: string
  description: string
  tag: string
  manageUrl?: string
  obsUrl: string
}

const obsEntries: ObsQuickEntry[] = [
  {
    id: 'controller',
    name: '手柄操作投屏',
    description: '支持 Xbox、PlayStation、Switch 等，高帧率实时展示按键与摇杆动作',
    tag: '已就绪',
    obsUrl: '/obs-store/gamepad',
  },
  {
    id: 'danmuji',
    name: '弹幕姬 (blivechat 风格)',
    description: '直播间弹幕、醒目留言、礼物舰长浮层',
    tag: '弹幕',
    manageUrl: '/manage/danmuji',
    obsUrl: '/obs/danmuji',
  },
  {
    id: 'queue',
    name: '弹幕排队看板',
    description: '观众发送指定弹幕自动入队并滚动排队',
    tag: '互动',
    manageUrl: '/open-live/queue',
    obsUrl: '/obs/queue',
  },
  {
    id: 'live-request',
    name: '弹幕点歌卡片',
    description: '弹幕点播正在播放歌曲与候选歌单展示',
    tag: '音乐',
    manageUrl: '/open-live/live-request',
    obsUrl: '/obs/live-request',
  },
  {
    id: 'question-display',
    name: '提问箱直播卡片',
    description: '主控台一键切题并在直播画面上展示提问',
    tag: '提问箱',
    manageUrl: '/manage/question-box',
    obsUrl: '/obs/question-display',
  },
]
</script>

<template>
  <div class="obs-store-page">
    <NPageHeader title="OBS 浏览器源组件中心">
      <template #subtitle>
        为直播量身打造的高性能、低延迟 OBS 浏览器源插件集合
      </template>
    </NPageHeader>

    <!-- OBS 常用组件快捷卡片 -->
    <NGrid
      cols="1 s:2 m:3 l:5"
      responsive="screen"
      :x-gap="12"
      :y-gap="12"
      style="margin: 16px 0 24px"
    >
      <NGridItem
        v-for="item in obsEntries"
        :key="item.id"
      >
        <NCard
          size="small"
          hoverable
          class="obs-entry-card"
        >
          <NFlex
            justify="space-between"
            align="center"
            style="margin-bottom: 6px"
          >
            <span class="obs-entry-title">{{ item.name }}</span>
            <NTag
              size="tiny"
              :type="item.id === 'controller' ? 'success' : 'default'"
            >
              {{ item.tag }}
            </NTag>
          </NFlex>
          <NText
            depth="3"
            class="obs-entry-desc"
          >
            {{ item.description }}
          </NText>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 手柄组件主控制台 -->
    <GamepadViewer />
  </div>
</template>

<style scoped>
.obs-store-page {
  padding: 16px 20px;
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
}

.obs-entry-card {
  height: 100%;
  border-radius: var(--vtsuru-radius);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.obs-entry-card:hover {
  transform: translateY(-2px);
}

.obs-entry-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.obs-entry-desc {
  font-size: 12px;
  line-height: 1.5;
  display: block;
}
</style>
