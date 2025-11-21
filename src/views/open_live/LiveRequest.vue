// 这是LiveRequest重构后的代码

<script setup lang="ts">
import type {
  OpenLiveInfo,
} from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDivider,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLi,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NText,
  NTooltip,
  NUl,
  useMessage,
} from 'naive-ui'
import { onActivated, onDeactivated, onMounted, onUnmounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  FunctionTypes,
} from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import LiveRequestOBS from '../obs/LiveRequestOBS.vue'

import SongRequestHistory from './components/SongRequestHistory.vue'
// 子组件
import SongRequestList from './components/SongRequestList.vue'
import SongRequestSettings from './components/SongRequestSettings.vue'

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()
const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()
const client = await useDanmakuClient().initOpenlive()

// OBS相关设置
const showOBSModal = ref(false)
const obsStyleType = ref<'classic' | 'fresh' | 'minimal'>('classic')
const obsScrollSpeedMultiplierRef = ref(1)
const volumn = useStorage('Settings.Volumn', 0.5)

// 使用composable管理歌曲请求核心逻辑
const liveRequest = useLiveRequest()

// 提供activeSongs给子组件
provide('activeSongs', liveRequest.activeSongs)

// 控制歌曲请求功能开关
async function onUpdateFunctionEnable() {
  if (accountInfo.value.id) {
    const oldValue = JSON.parse(JSON.stringify(accountInfo.value.settings.enableFunctions))
    if (accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.LiveRequest)) {
      accountInfo.value.settings.enableFunctions = accountInfo.value.settings.enableFunctions.filter(
        f => f != FunctionTypes.LiveRequest,
      )
    } else {
      accountInfo.value.settings.enableFunctions.push(FunctionTypes.LiveRequest)
    }
    if (!accountInfo.value.settings.songRequest.orderPrefix) {
      accountInfo.value.settings.songRequest.orderPrefix = liveRequest.defaultPrefix
    }
    await SaveEnableFunctions(accountInfo.value?.settings.enableFunctions)
      .then((data) => {
        if (data.code == 200) {
          message.success(
            `已${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.LiveRequest) ? '启用' : '禁用'}点播功能`,
          )
        } else {
          if (accountInfo.value.id) {
            accountInfo.value.settings.enableFunctions = oldValue
          }
          message.error(
            `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.LiveRequest) ? '启用' : '禁用'}失败: ${data.message}`,
          )
        }
      })
      .catch((err) => {
        message.error(
          `点播功能${accountInfo.value?.settings.enableFunctions.includes(FunctionTypes.LiveRequest) ? '启用' : '禁用'}失败: ${err}`,
        )
      })
  }
}

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
  <!-- 顶部功能开关与全局操作 -->
  <NCard v-if="accountInfo.id" size="small">
    <template #header>
      <NSpace align="center" justify="space-between">
        <NSpace align="center">
          <NText>启用弹幕点播功能</NText>
          <NSwitch
            :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
            @update:value="onUpdateFunctionEnable"
          />
        </NSpace>
        
        <!-- OBS 组件按钮 -->
        <NTooltip>
          <template #trigger>
            <NButton
              type="primary"
              size="small"
              :disabled="!accountInfo"
              @click="showOBSModal = true"
            >
              OBS 组件
            </NButton>
          </template>
          {{ liveRequest.configCanEdit ? '配置 OBS 样式与参数' : '登陆后才可以使用此功能' }}
        </NTooltip>
      </NSpace>
    </template>
    
    <!-- 提示信息 -->
    <NAlert
      v-if="accountInfo.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
      type="info"
      closable
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
      则其需要保持此页面开启才能点播, 也不要同时开多个页面, 会导致点播重复 (部署了则不影响)
    </NAlert>
  </NCard>

  <NAlert
    v-else
    type="warning"
    title="你尚未注册并登录 VTsuru.live, 大部分规则设置将不可用 (因为我懒得在前端重写一遍逻辑)"
  >
    <NButton
      tag="a"
      href="/manage"
      target="_blank"
      type="primary"
    >
      前往登录或注册
    </NButton>
  </NAlert>

  <!-- 主体内容 -->
  <NCard style="margin-top: 12px">
    <NTabs
      v-if="!accountInfo || accountInfo.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
      type="line"
      animated
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
      >
        请先启用弹幕点播功能
      </NAlert>
    </template>
  </NCard>
  <NModal
    v-model:show="showOBSModal"
    title="OBS组件"
    preset="card"
    style="width: 800px"
  >
    <template #header-extra>
      <NButton
        tag="a"
        type="primary"
        target="_blank"
        :href="`${CURRENT_HOST}obs/live-request?id=${accountInfo?.id ?? 0}&style=${obsStyleType}&speed=${obsScrollSpeedMultiplierRef}`"
      >
        浏览
      </NButton>
    </template>
    <NAlert
      title="这是什么?  "
      type="info"
    >
      将等待队列以及结果显示在OBS中
    </NAlert>

    <NDivider>样式与速度</NDivider>
    <NSpace align="center">
      <NRadioGroup
        v-model:value="obsStyleType"
        name="obsStyle"
      >
        <NSpace>
          <NRadioButton value="classic">
            经典黑色风格
          </NRadioButton>
          <NRadioButton value="fresh">
            清新明亮风格
          </NRadioButton>
          <NRadioButton value="minimal">
            极简无背景
          </NRadioButton>
        </NSpace>
      </NRadioGroup>
      <NInputGroup style="width: 200px">
        <NInputGroupLabel>滚动速度倍率</NInputGroupLabel>
        <NInputNumber
          v-model:value="obsScrollSpeedMultiplierRef"
          :min="0.5"
          :max="5"
          :step="0.1"
          placeholder="1"
        />
      </NInputGroup>
      <NTooltip>
        <template #trigger>
          <NIcon :component="Info24Filled" />
        </template>
        数值越大滚动越快 (0.5 ~ 5)
      </NTooltip>
    </NSpace>

    <NDivider>预览</NDivider>
    <div style="height: 500px; width: 280px; position: relative; margin: 0 auto">
      <LiveRequestOBS
        :id="accountInfo?.id"
        :key="`${accountInfo?.id}-${obsStyleType}-${obsScrollSpeedMultiplierRef}`"
        :style="obsStyleType"
        :speed-multiplier="obsScrollSpeedMultiplierRef"
      />
    </div>
    <br>
    <NInput
      :value="`${CURRENT_HOST}obs/live-request?id=${accountInfo?.id ?? 0}&style=${obsStyleType}&speed=${obsScrollSpeedMultiplierRef}`"
      readonly
    />
    <NDivider />
    <NCollapse>
      <NCollapseItem title="使用说明">
        <NUl>
          <NLi>在 OBS 来源中添加源, 选择 浏览器</NLi>
          <NLi>在 URL 栏填入上方链接</NLi>
          <NLi>根据自己的需要调整宽度和高度 (这里是宽 280px 高 500px)</NLi>
          <NLi>样式可选"经典黑色风格"或"清新明亮风格"</NLi>
          <NLi>使用URL中的style参数可以切换不同样式</NLi>
        </NUl>
      </NCollapseItem>
    </NCollapse>
  </NModal>
</template>

<style>
@keyframes loading {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0);
  }
}

@keyframes animated-border-round {
  0% {
    box-shadow: 0 0 0px #589580;
    border-radius: 50%;
  }

  100% {
    box-shadow: 0 0 0 5px rgba(255, 255, 255, 0);
    border-radius: 50%;
  }
}
</style>
