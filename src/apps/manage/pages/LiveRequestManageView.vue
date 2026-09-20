<script setup lang="ts">
import {
  Color24Regular,
  Copy24Regular,
  Desktop24Regular,
  Eye24Regular,
  Play24Filled,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
  Video24Filled,
  Video24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NFlex,
  NGi,
  NGrid,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, provide, ref } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { OpenLiveInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongRequestHistory from '@/apps/open-live/components/request/SongRequestHistory.vue'
import SongRequestList from '@/apps/open-live/components/request/SongRequestList.vue'
import SongRequestSettings from '@/apps/open-live/components/request/SongRequestSettings.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import { useFunctionToggle } from '@/composables/useFunctionToggle'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { copyToClipboard } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const accountInfo = useAccount()
const message = useMessage()
const client = await useDanmakuClient().initOpenlive()

// 主 Tab
const activeMainTab = ref<'requests' | 'preview' | 'settings'>('requests')

// OBS 调试与样式
const obsStyleType = ref<'glass' | 'transparent' | 'classic' | 'fresh' | 'minimal'>('glass')
const obsScrollSpeed = ref(1.0)
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')

// 计算 OBS 链接
const obsUrl = computed(() => {
  const params: Record<string, string> = {
    style: obsStyleType.value,
  }
  if (obsScrollSpeed.value !== 1.0) {
    params.speed = obsScrollSpeed.value.toString()
  }
  return buildObsSourceUrl({
    path: 'obs/live-request',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params,
  })
})

const liveRequest = useLiveRequest()
provide('activeSongs', liveRequest.activeSongs)

const { enabled: liveRequestEnabled, toggle: onUpdateFunctionEnable } = useFunctionToggle(FunctionTypes.LiveRequest, {
  label: '点播功能',
  onBeforeEnable: () => {
    if (!accountInfo.value.settings.songRequest.orderPrefix) {
      accountInfo.value.settings.songRequest.orderPrefix = liveRequest.defaultPrefix
    }
  },
})

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('点播 OBS 源链接已复制 (已携带当前样式参数)')
}

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

onMounted(() => {
  client.onEvent('danmaku', liveRequest.onGetDanmaku)
  client.onEvent('sc', liveRequest.onGetSC)
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
  <div class="live-request-manage-view">
    <ManagePageHeader
      title="弹幕点播系统"
      subtitle="观众通过发送弹幕指令（如 点播 BV号）或醒目留言触发点歌/点播，支持自动拉取信息、播放控制与 OBS 动态呈现"
      :function-type="FunctionTypes.LiveRequest"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
        },
      ]"
    />

    <NTabs
      v-model:value="activeMainTab"
      type="segment"
      animated
      class="main-nav-tabs"
      style="margin-top: 14px"
    >
      <!-- ================= Tab 1: 当前点播与播放器 ================= -->
      <NTabPane name="requests">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Video24Regular" />
            <span>当前点播与控制</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <!-- 内嵌播放器 -->
          <Transition>
            <div v-if="liveRequest.selectedSong" class="song-player-box">
              <SongPlayer
                v-model:is-lrc-loading="liveRequest.isLrcLoading"
                :song="liveRequest.selectedSong"
              />
              <NDivider style="margin: 10px 0" />
            </div>
          </Transition>

          <!-- 点播清单 -->
          <SongRequestList
            @update:sort-type="
              (value: any) => {
                accountInfo.settings.songRequest.sortType = value
                updateSettings()
              }
            "
            @update:is-reverse="
              (value: any) => {
                if (liveRequest.configCanEdit) {
                  accountInfo.settings.songRequest.isReverse = value
                  updateSettings()
                } else {
                  liveRequest.isReverse = value
                }
              }
            "
          />
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 2: OBS 1080P 舞台预览与仿真调试 ================= -->
      <NTabPane name="preview">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Desktop24Regular" />
            <span>OBS 舞台预览与仿真</span>
          </NFlex>
        </template>
        <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen" style="margin-top: 14px">
          <!-- 舞台视口 (占 8 列) -->
          <NGi :span="8">
            <NCard size="small">
              <template #header>
                <NFlex justify="space-between" align="center">
                  <NFlex align="center" :size="8">
                    <NIcon :component="Eye24Regular" />
                    <NText strong>OBS 画布实时预览 (1080P 比例视口)</NText>
                  </NFlex>

                  <NRadioGroup v-model:value="previewBg" size="small">
                    <NRadioButton value="checker">透明网格</NRadioButton>
                    <NRadioButton value="dark">纯黑背景</NRadioButton>
                    <NRadioButton value="light">浅色背景</NRadioButton>
                    <NRadioButton value="game">游戏场景</NRadioButton>
                  </NRadioGroup>
                </NFlex>
              </template>

              <!-- 视口容器 -->
              <div class="stage-viewport" :class="[`bg-${previewBg}`]">
                <div class="stage-canvas">
                  <LiveRequestOBS
                    :id="accountInfo?.id"
                    :key="`${accountInfo?.id}-${obsStyleType}-${obsScrollSpeed}`"
                    :style="obsStyleType"
                    :speed-multiplier="obsScrollSpeed"
                  />
                </div>
              </div>

              <template #action>
                <NFlex justify="space-between" align="center">
                  <NText depth="3" style="font-size: 12px">
                    推荐 OBS 来源尺寸：宽 380px ~ 440px，高 540px ~ 680px。
                  </NText>
                  <NButton size="small" type="primary" @click="copyObsLink">
                    <template #icon><NIcon :component="Copy24Regular" /></template>
                    复制当前样式 OBS 链接
                  </NButton>
                </NFlex>
              </template>
            </NCard>
          </NGi>

          <!-- 样式与仿真控制器 (占 4 列) -->
          <NGi :span="4">
            <NFlex vertical :size="16">
              <NCard size="small">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Color24Regular" />
                    <span>OBS 视觉预设</span>
                  </NFlex>
                </template>
                <NFlex vertical :size="12">
                  <NRadioGroup v-model:value="obsStyleType" size="small">
                    <NFlex vertical :size="8">
                      <NRadioButton value="glass" style="width: 100%">
                        毛玻璃质感 (Modern Glass)
                      </NRadioButton>
                      <NRadioButton value="transparent" style="width: 100%">
                        纯透明无底壳 (Transparent - 贴图专用)
                      </NRadioButton>
                      <NRadioButton value="minimal" style="width: 100%">
                        极简通透流 (Minimal Text)
                      </NRadioButton>
                      <NRadioButton value="classic" style="width: 100%">
                        经典卡片 (Classic Dark)
                      </NRadioButton>
                      <NRadioButton value="fresh" style="width: 100%">
                        清新自然 (Fresh Light)
                      </NRadioButton>
                    </NFlex>
                  </NRadioGroup>

                  <NDivider style="margin: 4px 0" />

                  <NFlex justify="space-between" align="center">
                    <span style="font-size: 12px; color: var(--vtsuru-fg-muted)">滚动轮播速度：</span>
                    <NInputNumber
                      v-model:value="obsScrollSpeed"
                      :min="0.5"
                      :max="3"
                      :step="0.2"
                      size="tiny"
                      style="width: 100px"
                    >
                      <template #suffix>x</template>
                    </NInputNumber>
                  </NFlex>
                </NFlex>
              </NCard>
            </NFlex>
          </NGi>
        </NGrid>
      </NTabPane>

      <!-- ================= Tab 3: 点播历史与规则配置 ================= -->
      <NTabPane name="settings">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Settings24Regular" />
            <span>规则设置与历史</span>
          </NFlex>
        </template>
        <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen" style="margin-top: 14px">
          <!-- 历史 (占 7 列) -->
          <NGi :span="7">
            <SongRequestHistory />
          </NGi>

          <!-- 规则 (占 5 列) -->
          <NGi :span="5">
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="6">
                  <NIcon :component="ShieldCheckmark24Regular" />
                  <span>点播指令与权限设置</span>
                </NFlex>
              </template>
              <SongRequestSettings
                :is-loading="liveRequest.isLoading"
                :is-logged-in="!!accountInfo.id"
              />
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.live-request-manage-view {
  width: 100%;
}

.main-nav-tabs {
  --n-tab-padding: 6px 16px !important;
}

.main-nav-tabs :deep(.n-tabs-rail) {
  width: fit-content;
  max-width: 100%;
}

.main-nav-tabs :deep(.n-tabs-tab) {
  white-space: nowrap;
  font-weight: 500;
}

/* 1080P 舞台视口 */
.stage-viewport {
  width: 100%;
  height: 520px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--vtsuru-border);
}

.stage-viewport.bg-checker {
  background-image: linear-gradient(45deg, #1e293b 25%, transparent 25%),
    linear-gradient(-45deg, #1e293b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1e293b 75%),
    linear-gradient(-45deg, transparent 75%, #1e293b 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #0f172a;
}

.stage-viewport.bg-dark { background-color: #000000; }
.stage-viewport.bg-light { background-color: #f1f5f9; }
.stage-viewport.bg-game {
  background: linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.75)),
    radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 40%),
    radial-gradient(circle at 20% 80%, #ec4899 0%, transparent 40%), #090d16;
}

.stage-canvas {
  width: 380px;
  height: 480px;
  position: relative;
}
</style>
