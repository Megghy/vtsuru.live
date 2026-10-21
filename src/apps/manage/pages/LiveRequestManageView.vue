<script setup lang="ts">
import {
  Color24Regular,
  Copy24Regular,
  Desktop24Regular,
  Eye24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Video24Regular,
} from '@vicons/fluent'
import {  useMessage  } from '@/shared/utils'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, provide, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { OpenLiveInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongRequestHistory from '@/apps/open-live/components/request/SongRequestHistory.vue'
import SongRequestList from '@/apps/open-live/components/request/SongRequestList.vue'
import SongRequestSettings from '@/apps/open-live/components/request/SongRequestSettings.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { copyToClipboard } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
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

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('点播 OBS 源链接已复制 (已携带当前样式参数)')
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
  <div class="space-y-4 w-full">
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

    <Tabs
      v-model="activeMainTab"
      class="w-full"
    >
      <TabsList class="grid w-full grid-cols-3 max-w-md h-8 p-0.5 bg-muted">
        <TabsTrigger
          value="requests"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Video24Regular"
            class="h-3.5 w-3.5"
          />
          当前点播与控制
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Desktop24Regular"
            class="h-3.5 w-3.5"
          />
          OBS 舞台预览
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Settings24Regular"
            class="h-3.5 w-3.5"
          />
          规则与历史
        </TabsTrigger>
      </TabsList>

      <!-- Tab 1: 当前点播与控制 -->
      <TabsContent
        value="requests"
        class="mt-3 space-y-3"
      >
        <!-- 内嵌播放器 -->
        <Transition>
          <div
            v-if="liveRequest.selectedSong"
            class="space-y-3"
          >
            <SongPlayer
              v-model:is-lrc-loading="liveRequest.isLrcLoading"
              :song="liveRequest.selectedSong"
            />
            <Separator />
          </div>
        </Transition>

        <!-- 点播清单 -->
        <SongRequestList />
      </TabsContent>

      <!-- Tab 2: OBS 舞台预览 -->
      <TabsContent
        value="preview"
        class="mt-3"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 舞台视口 (8 列) -->
          <Card class="lg:col-span-8 flex flex-col">
            <CardHeader class="p-3.5 pb-2">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                  <component
                    :is="Eye24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold">
                    OBS 画布实时预览 (1080P 比例视口)
                  </CardTitle>
                </div>

                <div class="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                  <Button
                    v-for="bg in [
                      { key: 'checker', label: '网格' },
                      { key: 'dark', label: '纯黑' },
                      { key: 'light', label: '浅色' },
                      { key: 'game', label: '模拟游戏' },
                    ]"
                    :key="bg.key"
                    size="xs"
                    :variant="previewBg === bg.key ? 'default' : 'ghost'"
                    class="h-6 text-xs px-2"
                    @click="previewBg = bg.key as any"
                  >
                    {{ bg.label }}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent class="p-4 flex-1 flex flex-col justify-between space-y-4">
              <div
                class="rounded-lg border border-border p-6 flex items-center justify-center min-h-[460px] transition-colors"
                :class="{
                  'bg-[#121214]': previewBg === 'dark',
                  'bg-[#f4f4f5]': previewBg === 'light',
                  'bg-[#0b132b]': previewBg === 'game',
                  'bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]': previewBg === 'checker',
                }"
              >
                <div class="w-[380px] max-w-full">
                  <LiveRequestOBS
                    :id="accountInfo?.id"
                    :key="`${accountInfo?.id}-${obsStyleType}-${obsScrollSpeed}`"
                    :style="obsStyleType"
                    :speed-multiplier="obsScrollSpeed"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border/60">
                <span class="text-xs text-muted-foreground">推荐 OBS 来源尺寸：宽 380px ~ 440px，高 540px ~ 680px。</span>
                <Button
                  size="xs"
                  variant="brand"
                  @click="copyObsLink"
                >
                  <component
                    :is="Copy24Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  复制当前样式 OBS 链接
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 视觉预设 (4 列) -->
          <div class="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="Color24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                    OBS 视觉预设
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent class="p-3.5 space-y-3.5">
                <div class="grid grid-cols-1 gap-1.5">
                  <Button
                    v-for="st in [
                      { key: 'glass', label: '毛玻璃质感 (Modern Glass)' },
                      { key: 'transparent', label: '纯透明无底壳 (Transparent)' },
                      { key: 'minimal', label: '极简通透流 (Minimal Text)' },
                      { key: 'classic', label: '经典卡片 (Classic Dark)' },
                      { key: 'fresh', label: '清新自然 (Fresh Light)' },
                    ]"
                    :key="st.key"
                    size="sm"
                    :variant="obsStyleType === st.key ? 'default' : 'outline'"
                    class="w-full justify-start text-xs font-normal"
                    @click="obsStyleType = st.key as any"
                  >
                    {{ st.label }}
                  </Button>
                </div>

                <Separator />

                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-muted-foreground">滚动轮播速度</span>
                  <div class="flex items-center gap-1.5">
                    <Input
                      v-model.number="obsScrollSpeed"
                      type="number"
                      step="0.2"
                      min="0.5"
                      max="3"
                      class="w-20 h-7 text-xs font-mono"
                    />
                    <span class="text-xs text-muted-foreground">x</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <!-- Tab 3: 规则设置与历史 -->
      <TabsContent
        value="settings"
        class="mt-3"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 历史 (7 列) -->
          <div class="lg:col-span-7">
            <SongRequestHistory />
          </div>

          <!-- 规则 (5 列) -->
          <div class="lg:col-span-5">
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="ShieldCheckmark24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                    点播指令与权限设置
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent class="p-3.5">
                <SongRequestSettings
                  :is-loading="liveRequest.isLoading"
                  :is-logged-in="!!accountInfo.id"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
