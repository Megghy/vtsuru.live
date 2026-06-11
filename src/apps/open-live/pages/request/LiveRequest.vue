<script setup lang="ts">
import type {
  OpenLiveInfo,
} from '@/api/api-models'
import {
  NAlert, NButton, NCard, NDivider, NTabPane, NTabs, NTooltip, useMessage } from 'naive-ui';
import { onActivated, onDeactivated, onMounted, onUnmounted, provide, ref } from 'vue'
import { SaveSetting, useAccount } from '@/api/account'
import {
  FunctionTypes,
} from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import { useFunctionToggle } from '@/composables/useFunctionToggle'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import ObsConfigModal from '@/apps/open-live/components/ObsConfigModal.vue'
import OpenLivePageLayout from '@/apps/open-live/components/OpenLivePageLayout.vue'

import SongRequestHistory from '@/apps/open-live/components/request/SongRequestHistory.vue'
import SongRequestList from '@/apps/open-live/components/request/SongRequestList.vue'
import SongRequestSettings from '@/apps/open-live/components/request/SongRequestSettings.vue'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()
const accountInfo = useAccount()
const message = useMessage()
const client = await useDanmakuClient().initOpenlive()

// OBS相关设置
const showOBSModal = ref(false)
const obsStyleType = ref<'classic' | 'fresh' | 'minimal'>('classic')
const obsScrollSpeedMultiplierRef = ref(1)

// 使用composable管理歌曲请求核心逻辑
const liveRequest = useLiveRequest()

// 提供activeSongs给子组件
provide('activeSongs', liveRequest.activeSongs)

// 控制歌曲请求功能开关
const { enabled: liveRequestEnabled, toggle: onUpdateFunctionEnable } = useFunctionToggle(FunctionTypes.LiveRequest, {
  label: '点播功能',
  onBeforeEnable: () => {
    if (!accountInfo.value.settings.songRequest.orderPrefix) {
      accountInfo.value.settings.songRequest.orderPrefix = liveRequest.defaultPrefix
    }
  },
})

// 更新歌曲请求设置
async function updateSettings() {
  if (accountInfo.value.id) {
    liveRequest.isLoading = true
    await SaveSetting('SongRequest', accountInfo.value.settings.songRequest)
      .then((msg) => {
        if (msg) {
          message.success('已保存')
          return true
        } else {
          message.error(`保存失败: ${msg}`)
        }
      })
      .finally(() => {
        liveRequest.isLoading = false
      })
  } else {
    message.success('完成')
  }
}

// 生命周期钩子
onMounted(() => {
  client.onEvent('danmaku', liveRequest.onGetDanmaku)
  client.onEvent('sc', liveRequest.onGetSC)
  liveRequest.init()
})

onActivated(() => {
  liveRequest.init()
})

onDeactivated(() => {
  liveRequest.dispose()
})

onUnmounted(() => {
  client.offEvent('danmaku', liveRequest.onGetDanmaku)
  client.offEvent('sc', liveRequest.onGetSC)
  liveRequest.dispose()
})
</script>

<template>
  <OpenLivePageLayout
    title="弹幕点播"
    description="通过弹幕或 SC 触发点歌/点播，支持 OBS 展示与规则配置"
    :is-logged-in="!!accountInfo.id"
    show-function-switch
    switch-label="启用弹幕点播功能"
    :enabled="liveRequestEnabled"
    @update:enabled="onUpdateFunctionEnable"
  >
    <template v-if="accountInfo.id" #actions>
      <NTooltip>
        <template #trigger>
          <NButton
            type="primary"
            size="small"
            class="open-live-action-btn"
            :disabled="!accountInfo"
            @click="showOBSModal = true"
          >
            OBS 组件
          </NButton>
        </template>
        {{ liveRequest.configCanEdit ? '配置 OBS 样式与参数' : '登陆后才可以使用此功能' }}
      </NTooltip>
    </template>

    <template #switch-extra>
      <NAlert
        type="info"
        size="small"
        :bordered="false"
        style="margin-top: 10px"
      >
        如果没有部署
        <NButton
          text
          type="primary"
          tag="a"
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
        >
          VtsuruEventFetcher
        </NButton>
        ，则需要保持此页面开启才能点播；也不要同时开多个页面（可能导致点播重复）。
      </NAlert>
    </template>

    <!-- 主体内容 -->
    <NCard size="small" bordered>
      <NTabs
        v-if="!accountInfo?.id || liveRequestEnabled"
        type="line"
        animated
        size="small"
        display-directive="show:lazy"
      >
        <NTabPane
          name="list"
          tab="列表"
        >
          <!-- 歌曲播放器 -->
          <Transition>
            <div
              v-if="liveRequest.selectedSong"
              class="song-list"
              style="margin-bottom: 15px"
            >
              <SongPlayer
                v-model:is-lrc-loading="liveRequest.isLrcLoading"
                :song="liveRequest.selectedSong"
              />
              <NDivider style="margin: 15px 0" />
            </div>
          </Transition>

          <!-- 活跃歌曲列表 -->
          <SongRequestList
            @update:sort-type="(value: any) => { accountInfo.settings.songRequest.sortType = value; updateSettings() }"
            @update:is-reverse="(value: any) => {
              if (liveRequest.configCanEdit) {
                accountInfo.settings.songRequest.isReverse = value
                updateSettings()
              }
              else {
                liveRequest.isReverse = value
              }
            }"
          />
        </NTabPane>
        <NTabPane
          name="history"
          tab="历史"
        >
          <!-- 历史歌曲记录 -->
          <SongRequestHistory />
        </NTabPane>
        <NTabPane
          name="setting"
          tab="设置"
        >
          <!-- 歌曲请求设置 -->
          <SongRequestSettings />
        </NTabPane>
      </NTabs>
      <template v-else>
        <NAlert
          title="未启用"
          type="error"
          size="small"
          :bordered="false"
        >
          请先启用弹幕点播功能
        </NAlert>
      </template>
    </NCard>
  </OpenLivePageLayout>

  <ObsConfigModal
    v-model:show="showOBSModal"
    v-model:speed="obsScrollSpeedMultiplierRef"
    v-model:style-type="obsStyleType"
    obs-path="obs/live-request"
    :user-id="accountInfo?.id"
    description="将等待队列以及结果显示在 OBS 中。"
  >
    <template #preview="{ styleType, speed }">
      <LiveRequestOBS
        :id="accountInfo?.id"
        :key="`${accountInfo?.id}-${styleType}-${speed}`"
        :style="styleType"
        :speed-multiplier="speed"
      />
    </template>
  </ObsConfigModal>
</template>

<style scoped>
.open-live-action-btn {
  max-width: 220px;
}
</style>
