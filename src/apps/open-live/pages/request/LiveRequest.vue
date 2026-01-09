// 这是LiveRequest重构后的代码

<script setup lang="ts">
import type {
  OpenLiveInfo,
} from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDivider,
  NFlex,
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
import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  FunctionTypes,
} from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { CURRENT_HOST } from '@/shared/config'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

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
  <NFlex vertical :size="12">
    <NCard size="small" bordered>
      <OpenLivePageHeader
        title="弹幕点播"
        description="通过弹幕或 SC 触发点歌/点播，支持 OBS 展示与规则配置"
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
      </OpenLivePageHeader>
    </NCard>

    <!-- 顶部功能开关与提示 -->
    <NCard v-if="accountInfo.id" size="small" bordered>
      <NFlex align="center" justify="space-between" wrap :size="12">
        <NFlex align="center" wrap :size="10">
          <NText>启用弹幕点播功能</NText>
          <NSwitch
            size="small"
            :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
            @update:value="onUpdateFunctionEnable"
          />
        </NFlex>
      </NFlex>

      <NAlert
        v-if="accountInfo.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
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
    </NCard>

    <NAlert
      v-else
      type="warning"
      size="small"
      title="你尚未注册并登录 VTsuru.live，大部分规则设置将不可用"
      :bordered="false"
    >
      <NButton
        tag="a"
        href="/manage"
        target="_blank"
        type="primary"
        size="small"
        class="open-live-action-btn"
      >
        前往登录或注册
      </NButton>
    </NAlert>

    <!-- 主体内容 -->
    <NCard size="small" bordered>
      <NTabs
        v-if="!accountInfo || accountInfo.settings.enableFunctions.includes(FunctionTypes.LiveRequest)"
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
  </NFlex>

  <NModal
    v-model:show="showOBSModal"
    title="OBS组件"
    preset="card"
    style="width: 900px; max-width: 90vw"
  >
    <template #header-extra>
      <NButton
        tag="a"
        type="primary"
        size="small"
        target="_blank"
        :href="`${CURRENT_HOST}obs/live-request?id=${accountInfo?.id ?? 0}&style=${obsStyleType}&speed=${obsScrollSpeedMultiplierRef}`"
      >
        浏览
      </NButton>
    </template>
    <NAlert
      title="这是什么?  "
      type="info"
      size="small"
      :bordered="false"
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
      <NInputGroup style="width: 220px">
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

<style scoped>
.open-live-action-btn {
  max-width: 220px;
}
</style>
