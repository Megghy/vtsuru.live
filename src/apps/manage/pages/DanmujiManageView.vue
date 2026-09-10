<script setup lang="ts">
import {
  ArrowReset24Regular,
  CloudCheckmark24Regular,
  Copy16Regular,
  Save24Regular,
  Send24Regular,
  Sparkle24Regular,
} from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NIcon,
  NInput,
  NInputNumber,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSplit,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import MonacoEditorComponent from '@/apps/manage/components/MonacoEditorComponent.vue'
import type { DanmujiConfig } from '@/apps/obs/pages/DanmujiOBS.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard, isDarkMode } from '@/shared/utils'

const props = defineProps<{
  openLiveAuth?: AuthInfo
}>()

const accountInfo = useAccount()
const css = usePersistedStorage('danmuji-css', defaultDanmujiCss)
const danmujiObsRef = ref<InstanceType<typeof DanmujiOBS> | null>(null)
const message = useMessage()
const { width: windowWidth } = useWindowSize()

const isSavingCloud = ref(false)
const serverConfigSnapshot = ref<string>('')
const previewBgMode = ref<'transparent' | 'dark' | 'light' | 'game'>('transparent')

const obsUrl = computed(() => {
  const tokenUrl = buildObsSourceUrl({
    path: 'obs/danmuji',
    host: CURRENT_HOST,
    credential: 'token',
    token: accountInfo.value?.id ? accountInfo.value.token : undefined,
  })
  if (tokenUrl) return tokenUrl
  if (!props.openLiveAuth?.Code) return ''
  const params: Record<string, string> = {}
  for (const key of ['Timestamp', 'Code', 'Mid', 'Caller', 'CodeSign'] as const) {
    const value = props.openLiveAuth[key]
    if (value) params[key] = value
  }
  return buildObsSourceUrl({
    path: 'obs/danmuji',
    host: CURRENT_HOST,
    credential: 'none',
    params,
  })
})

const testFormData = reactive({
  type: EventDataTypes.Message,
  uname: '测试用户',
  uid: 10001,
  msg: '这是一条测试弹幕',
  price: 30,
  num: 1,
  guard_level: GuardLevel.Jianzhang,
  fans_medal_level: 10,
  fans_medal_name: '测试牌子',
  sc_id_to_delete: '',
})

const messageTypeOptions = [
  { label: '弹幕 (Message)', value: EventDataTypes.Message },
  { label: '礼物 (Gift)', value: EventDataTypes.Gift },
  { label: '舰长 (Guard)', value: EventDataTypes.Guard },
  { label: '醒目留言 (SC)', value: EventDataTypes.SC },
  { label: '删除SC (SCDel)', value: EventDataTypes.SCDel },
]

const guardLevelOptions = [
  { label: '非舰长', value: GuardLevel.None },
  { label: '舰长', value: GuardLevel.Jianzhang },
  { label: '提督', value: GuardLevel.Tidu },
  { label: '总督', value: GuardLevel.Zongdu },
]

function randomDigits(length = 4) {
  const min = length > 1 ? 10 ** (length - 1) : 0
  const max = 10 ** length - 1
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateTestUsername() {
  return `热心观众${randomDigits(4)}`
}

function generateTestMessage() {
  const templates = ['今晚开播辛苦啦！', '主播这把太帅了！', '打卡打卡~', '加油加油！', '刚才那波走位真细节']
  const template = templates[Math.floor(Math.random() * templates.length)]
  return `${template} (${randomDigits(3)})`
}

function generateTestGiftName() {
  const gifts = ['辣条', '小电视飞船', '小心心', 'B坷垃', '打call']
  return gifts[Math.floor(Math.random() * gifts.length)]
}

function generateTestMedalName() {
  const medals = ['小仙女', '头号粉丝', '干饭人', '元气满分']
  return medals[Math.floor(Math.random() * medals.length)]
}

// 保存 DanmujiConfig 配置
const danmujiConfig = usePersistedStorage<DanmujiConfig>('danmuji-config', {
  minGiftPrice: 0.1,
  showDanmaku: true,
  showGift: true,
  showGiftName: true,
  mergeSimilarDanmaku: false,
  mergeGift: true,
  maxNumber: 60,
  blockLevel: 0,
  blockKeywords: '',
  blockUsers: '',
  blockMedalLevel: 0,
  giftUsernamePronunciation: '',
  importPresetCss: false,
  emoticons: [],
})

const hasUnsavedConfig = computed(() => {
  if (!serverConfigSnapshot.value) return false
  return JSON.stringify(danmujiConfig.value) !== serverConfigSnapshot.value
})

const activeTab = usePersistedStorage('danmuji-active-tab', 'style')

// 自动模拟弹幕
const isAutoGenerating = ref(false)
const autoGenerateInterval = ref(1.5)
let autoGenerateTimer: ReturnType<typeof setTimeout> | null = null

const autoGenData = reactive({
  type: EventDataTypes.Message,
  uname: '',
  uid: 0,
  msg: '',
  price: 0,
  num: 1,
  guard_level: GuardLevel.None,
  fans_medal_level: 0,
  fans_medal_name: '',
})

function resetCssToDefault() {
  css.value = defaultDanmujiCss
  message.success('已重设为默认 CSS')
}

function resetConfigToDefault() {
  danmujiConfig.value = {
    minGiftPrice: 0.1,
    showDanmaku: true,
    showGift: true,
    showGiftName: true,
    mergeSimilarDanmaku: false,
    mergeGift: true,
    maxNumber: 60,
    blockLevel: 0,
    blockKeywords: '',
    blockUsers: '',
    blockMedalLevel: 0,
    giftUsernamePronunciation: '',
    importPresetCss: false,
    emoticons: [],
  }
  message.success('功能配置已重置为默认值')
}

function generateRandomContent() {
  testFormData.uname = generateTestUsername()
  testFormData.uid = Math.floor(Math.random() * 90000) + 10000

  switch (testFormData.type) {
    case EventDataTypes.Message: {
      testFormData.msg = generateTestMessage()
      testFormData.fans_medal_level = Math.floor(Math.random() * 31)
      testFormData.fans_medal_name = generateTestMedalName()
      const guardRandomIndex = Math.floor(Math.random() * guardLevelOptions.length)
      testFormData.guard_level = guardLevelOptions[guardRandomIndex].value
      break
    }

    case EventDataTypes.Gift:
      testFormData.msg = generateTestGiftName()
      testFormData.num = Math.floor(Math.random() * 20) + 1
      testFormData.price = Math.floor(Math.random() * 50) + 1
      break

    case EventDataTypes.Guard: {
      const guardOptions = guardLevelOptions.filter((option) => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      testFormData.guard_level = guardOptions[guardIndex].value
      break
    }

    case EventDataTypes.SC:
      testFormData.msg = generateTestMessage()
      testFormData.price = Math.floor(Math.random() * 496) + 5
      break

    case EventDataTypes.SCDel:
      testFormData.sc_id_to_delete = `test-sc-${Date.now() - Math.floor(Math.random() * 10000)}`
      break
  }
}

function sendTestMessage() {
  if (!danmujiObsRef.value) return

  let dataPayload: any = {}
  const baseMsg = testFormData.msg
  const basePrice = testFormData.price
  const baseGuardLevel = testFormData.guard_level

  switch (testFormData.type) {
    case EventDataTypes.Message:
      dataPayload = {
        msg_id: `test-danmaku-${Date.now()}`,
        timestamp: Date.now() / 1000,
        msg: testFormData.msg,
        uname: testFormData.uname,
        uid: testFormData.uid,
        guard_level: testFormData.guard_level,
        fans_medal_level: testFormData.fans_medal_level,
        fans_medal_name: testFormData.fans_medal_name,
      }
      break
    case EventDataTypes.Gift:
      dataPayload = {
        msg_id: `test-gift-${Date.now()}`,
        timestamp: Date.now() / 1000,
        gift_name: testFormData.msg,
        gift_num: testFormData.num,
        price: testFormData.price * 1000,
        paid: true,
        uname: testFormData.uname,
        uid: testFormData.uid,
      }
      break
    case EventDataTypes.Guard:
      dataPayload = {
        msg_id: `test-guard-${Date.now()}`,
        timestamp: Date.now() / 1000,
        guard_level: testFormData.guard_level,
        user_info: {
          uname: testFormData.uname,
          uid: testFormData.uid,
          uface: '',
        },
      }
      break
    case EventDataTypes.SC:
      dataPayload = {
        msg_id: `test-sc-${Date.now()}`,
        timestamp: Date.now() / 1000,
        message: testFormData.msg,
        rmb: testFormData.price,
        uname: testFormData.uname,
        uid: testFormData.uid,
      }
      break
    case EventDataTypes.SCDel:
      dataPayload = {
        message_ids: [testFormData.sc_id_to_delete || `test-sc-${Date.now() - 5000}`],
      }
      break
  }

  const eventToSend = {
    type: testFormData.type,
    uname: testFormData.uname,
    uid: Number(testFormData.uid ?? 0),
    msg: dataPayload.message ?? dataPayload.msg ?? baseMsg,
    price: Number(dataPayload.rmb ?? basePrice ?? 0),
    num: Number(testFormData.num ?? 1),
    guard_level: dataPayload.guard_level ?? baseGuardLevel,
    fans_medal_level: Number(testFormData.fans_medal_level ?? 0),
    fans_medal_name: testFormData.fans_medal_name,
    time: dataPayload.timestamp ?? Date.now() / 1000,
    data: dataPayload,
  }

  danmujiObsRef.value.testAddMessage(eventToSend as any)
}

function generateAutoContent() {
  autoGenData.uname = generateTestUsername()
  autoGenData.uid = Math.floor(Math.random() * 90000) + 10000

  switch (autoGenData.type) {
    case EventDataTypes.Message: {
      autoGenData.msg = generateTestMessage()
      autoGenData.fans_medal_level = Math.floor(Math.random() * 25)
      autoGenData.fans_medal_name = generateTestMedalName()
      const guardRandomIndex = Math.floor(Math.random() * guardLevelOptions.length)
      autoGenData.guard_level = guardLevelOptions[guardRandomIndex].value
      break
    }
    case EventDataTypes.Gift:
      autoGenData.msg = generateTestGiftName()
      autoGenData.num = Math.floor(Math.random() * 10) + 1
      autoGenData.price = Math.floor(Math.random() * 30) + 1
      break
    case EventDataTypes.Guard: {
      const guardOptions = guardLevelOptions.filter((option) => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      autoGenData.guard_level = guardOptions[guardIndex].value
      break
    }
    case EventDataTypes.SC:
      autoGenData.msg = generateTestMessage()
      autoGenData.price = Math.floor(Math.random() * 100) + 30
      break
  }
}

function sendAutoMessage() {
  if (!danmujiObsRef.value) return

  let dataPayload: any = {}

  switch (autoGenData.type) {
    case EventDataTypes.Message:
      dataPayload = {
        msg_id: `test-danmaku-${Date.now()}`,
        timestamp: Date.now() / 1000,
        msg: autoGenData.msg,
        uname: autoGenData.uname,
        uid: autoGenData.uid,
        guard_level: autoGenData.guard_level,
        fans_medal_level: autoGenData.fans_medal_level,
        fans_medal_name: autoGenData.fans_medal_name,
      }
      break
    case EventDataTypes.Gift:
      dataPayload = {
        msg_id: `test-gift-${Date.now()}`,
        timestamp: Date.now() / 1000,
        gift_name: autoGenData.msg,
        gift_num: autoGenData.num,
        price: autoGenData.price * 1000,
        paid: true,
        uname: autoGenData.uname,
        uid: autoGenData.uid,
      }
      break
    case EventDataTypes.Guard:
      dataPayload = {
        msg_id: `test-guard-${Date.now()}`,
        timestamp: Date.now() / 1000,
        guard_level: autoGenData.guard_level,
        user_info: {
          uname: autoGenData.uname,
          uid: autoGenData.uid,
          uface: '',
        },
      }
      break
    case EventDataTypes.SC:
      dataPayload = {
        msg_id: `test-sc-${Date.now()}`,
        timestamp: Date.now() / 1000,
        message: autoGenData.msg,
        rmb: autoGenData.price,
        uname: autoGenData.uname,
        uid: autoGenData.uid,
      }
      break
  }

  const eventToSend = {
    type: autoGenData.type,
    uname: autoGenData.uname,
    uid: Number(autoGenData.uid),
    msg: dataPayload.message ?? dataPayload.msg ?? autoGenData.msg,
    price: Number(dataPayload.rmb ?? autoGenData.price ?? 0),
    num: Number(autoGenData.num ?? 1),
    guard_level: dataPayload.guard_level ?? autoGenData.guard_level,
    fans_medal_level: Number(autoGenData.fans_medal_level ?? 0),
    fans_medal_name: autoGenData.fans_medal_name,
    time: dataPayload.timestamp ?? Date.now() / 1000,
    data: dataPayload,
  }

  danmujiObsRef.value.testAddMessage(eventToSend as any)
}

function startAutoGenerate() {
  if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
  }

  if (!isAutoGenerating.value) return

  const messageTypes = [EventDataTypes.Message, EventDataTypes.Gift, EventDataTypes.Guard, EventDataTypes.SC]
  autoGenData.type = Math.random() < 0.65 ? EventDataTypes.Message : messageTypes[Math.floor(Math.random() * messageTypes.length)]

  generateAutoContent()
  sendAutoMessage()

  autoGenerateTimer = setTimeout(startAutoGenerate, autoGenerateInterval.value * 1000)
}

function addInitialTestMessages() {
  if (!danmujiObsRef.value) return

  setTimeout(() => {
    for (let i = 0; i < 4; i++) {
      autoGenData.type = EventDataTypes.Message
      generateAutoContent()
      sendAutoMessage()
    }

    autoGenData.type = EventDataTypes.Gift
    generateAutoContent()
    sendAutoMessage()

    autoGenData.type = EventDataTypes.SC
    generateAutoContent()
    sendAutoMessage()
  }, 400)
}

watch(
  isAutoGenerating,
  (newValue) => {
    if (newValue) {
      startAutoGenerate()
    } else if (autoGenerateTimer) {
      clearTimeout(autoGenerateTimer)
      autoGenerateTimer = null
    }
  },
  { immediate: true },
)

async function downloadConfigFromServer() {
  const result = await DownloadConfig<DanmujiConfig>('danmuji-config')
  if (result.status === 'success' && result.data) {
    danmujiConfig.value = result.data
    serverConfigSnapshot.value = JSON.stringify(result.data)
    message.success('已同步云端弹幕机配置')
    return true
  }
  return false
}

async function uploadConfigToServer() {
  isSavingCloud.value = true
  try {
    const result = await UploadConfig('danmuji-config', danmujiConfig.value)
    if (result) {
      serverConfigSnapshot.value = JSON.stringify(danmujiConfig.value)
      message.success('弹幕机配置已保存并同步至云端')
    } else {
      message.error('上传弹幕机配置失败')
    }
  } catch (error) {
    message.error(`保存失败: ${error instanceof Error ? error.message : error}`)
  } finally {
    isSavingCloud.value = false
  }
}

async function copyObsUrl() {
  await copyToClipboard(obsUrl.value)
  message.success('OBS 浏览器源地址已复制')
}

async function copyCss() {
  await copyToClipboard(css.value)
  message.success('自定义 CSS 已复制到剪贴板')
}

onMounted(async () => {
  if (accountInfo.value?.id) await downloadConfigFromServer()
  addInitialTestMessages()
})

onUnmounted(() => {
  if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
    autoGenerateTimer = null
  }
})
</script>

<template>
  <div class="danmuji-manage-container">
    <NSplit
      class="danmuji-split"
      :direction="windowWidth < 960 ? 'vertical' : 'horizontal'"
      :min="0.32"
      :max="0.68"
      :default-size="0.44"
    >
      <template #1>
        <div class="left-panel-scroll-container">
          <NFlex
            vertical
            style="padding: 16px; height: 100%; box-sizing: border-box"
            :size="14"
          >
            <!-- 顶部 OBS 连接卡片 -->
            <NCard
              size="small"
              embedded
              class="obs-link-card"
            >
              <NFlex
                align="center"
                justify="space-between"
                :wrap="false"
                :size="12"
              >
                <div class="obs-label">
                  <span class="label-text">OBS 浏览器源地址</span>
                  <span class="label-desc">在 OBS 来源中添加“浏览器”并填入此 URL</span>
                </div>
                <NInput
                  size="small"
                  readonly
                  :value="obsUrl"
                  style="flex: 1; max-width: 360px"
                >
                  <template #suffix>
                    <NButton
                      text
                      type="primary"
                      size="tiny"
                      @click="copyObsUrl"
                    >
                      <template #icon><NIcon :component="Copy16Regular" /></template>
                      复制
                    </NButton>
                  </template>
                </NInput>
              </NFlex>

              <details class="obs-source-guide">
                <summary>OBS 来源配置三步指引</summary>
                <ol>
                  <li>在 OBS“来源”列表点击 <strong>+</strong>，选择<strong>“浏览器”</strong>新建来源。</li>
                  <li>将上方地址复制并粘贴到浏览器源的<strong>“URL”</strong>输入框中。</li>
                  <li>将下方“样式定制”里的完整 CSS 复制并粘贴到 OBS 浏览器源属性的<strong>“自定义 CSS”</strong>框中。</li>
                </ol>
              </details>
            </NCard>

            <NTabs
              v-model:value="activeTab"
              type="segment"
              animated
              class="main-tabs"
            >
              <!-- 样式定制 Tab -->
              <NTabPane
                name="style"
                tab="样式定制"
              >
                <div class="tab-content-wrapper">
                  <div class="editor-header">
                    <span class="editor-title">自定义 CSS 样式</span>
                    <NFlex :size="8">
                      <NButton
                        size="small"
                        secondary
                        @click="copyCss"
                      >
                        <template #icon><NIcon :component="Copy16Regular" /></template>
                        复制 CSS
                      </NButton>
                      <NPopconfirm @positive-click="resetCssToDefault">
                        <template #trigger>
                          <NButton
                            size="small"
                            type="warning"
                            secondary
                          >
                            <template #icon><NIcon :component="ArrowReset24Regular" /></template>
                            重设默认
                          </NButton>
                        </template>
                        确定要重设为默认 CSS 吗？这将清除当前所有自定义样式。
                      </NPopconfirm>
                    </NFlex>
                  </div>

                  <NAlert
                    class="css-transparency-alert"
                    type="info"
                    :bordered="false"
                  >
                    提示：OBS 浏览器源默认带白色底。请将下方完整 CSS 复制粘贴到 OBS 属性中的“自定义 CSS”框，应用后背景即完全透明。
                  </NAlert>

                  <div class="editor-container">
                    <MonacoEditorComponent
                      v-model:value="css"
                      language="css"
                      style="height: 100%; width: 100%"
                      :options="{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                        formatOnPaste: true,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        tabSize: 2,
                        bracketPairColorization: { enabled: true },
                        autoIndent: 'full',
                        folding: true,
                        scrollbar: {
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                        },
                      }"
                      :theme="isDarkMode ? 'vs-dark' : 'vs'"
                    />
                  </div>
                </div>
              </NTabPane>

              <!-- 功能配置 Tab -->
              <NTabPane
                name="config"
                tab="功能配置"
              >
                <div class="config-scroll-container">
                  <NCard
                    :bordered="false"
                    size="small"
                  >
                    <template #header>
                      <NFlex
                        justify="space-between"
                        align="center"
                      >
                        <NFlex
                          align="center"
                          :size="8"
                        >
                          <span>弹幕过滤与合并规则</span>
                          <NTag
                            v-if="hasUnsavedConfig"
                            size="small"
                            type="warning"
                            round
                          >
                            未同步到云端
                          </NTag>
                        </NFlex>

                        <NFlex :size="8">
                          <NButton
                            v-if="accountInfo?.id"
                            size="small"
                            type="primary"
                            :loading="isSavingCloud"
                            @click="uploadConfigToServer"
                          >
                            <template #icon><NIcon :component="hasUnsavedConfig ? Save24Regular : CloudCheckmark24Regular" /></template>
                            {{ hasUnsavedConfig ? '保存到云端 (未同步)' : '已同步云端' }}
                          </NButton>

                          <NPopconfirm @positive-click="resetConfigToDefault">
                            <template #trigger>
                              <NButton
                                size="small"
                                type="error"
                                secondary
                              >
                                重置
                              </NButton>
                            </template>
                            确定要重设为默认功能配置吗？
                          </NPopconfirm>
                        </NFlex>
                      </NFlex>
                    </template>

                    <NForm
                      :model="danmujiConfig"
                      label-placement="top"
                      size="small"
                    >
                      <div class="form-section-title">显示类型</div>
                      <NGrid
                        :x-gap="12"
                        :y-gap="8"
                        :cols="3"
                      >
                        <NGi>
                          <NCard
                            size="small"
                            embedded
                            class="checkbox-card"
                          >
                            <NCheckbox v-model:checked="danmujiConfig.showDanmaku"> 显示弹幕消息 </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard
                            size="small"
                            embedded
                            class="checkbox-card"
                          >
                            <NCheckbox v-model:checked="danmujiConfig.showGift"> 显示礼物消息 </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard
                            size="small"
                            embedded
                            class="checkbox-card"
                          >
                            <NCheckbox v-model:checked="danmujiConfig.showGiftName"> 显示礼物名称 </NCheckbox>
                          </NCard>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">合并策略</div>
                      <NGrid
                        :x-gap="12"
                        :y-gap="8"
                        :cols="2"
                      >
                        <NGi>
                          <NCard
                            size="small"
                            embedded
                            class="checkbox-card"
                          >
                            <NCheckbox v-model:checked="danmujiConfig.mergeSimilarDanmaku"> 合并相似弹幕 </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard
                            size="small"
                            embedded
                            class="checkbox-card"
                          >
                            <NCheckbox v-model:checked="danmujiConfig.mergeGift"> 合并连击礼物 </NCheckbox>
                          </NCard>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">阈值控制</div>
                      <NGrid
                        :x-gap="12"
                        :y-gap="8"
                        :cols="2"
                      >
                        <NGi>
                          <NFormItem
                            label="最大消息积压数"
                            path="maxNumber"
                          >
                            <NInputNumber
                              v-model:value="danmujiConfig.maxNumber"
                              :min="10"
                              :max="200"
                            />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem
                            label="最低显示礼物价值"
                            path="minGiftPrice"
                          >
                            <NInputNumber
                              v-model:value="danmujiConfig.minGiftPrice"
                              :min="0"
                              :step="0.1"
                            >
                              <template #suffix> 元 </template>
                            </NInputNumber>
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">过滤与屏蔽规则</div>
                      <NGrid
                        :x-gap="12"
                        :y-gap="8"
                        :cols="2"
                      >
                        <NGi>
                          <NFormItem
                            label="屏蔽舰长等级低于"
                            path="blockLevel"
                          >
                            <NSelect
                              v-model:value="danmujiConfig.blockLevel"
                              :options="guardLevelOptions"
                            />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem
                            label="屏蔽粉丝牌等级低于"
                            path="blockMedalLevel"
                          >
                            <NInputNumber
                              v-model:value="danmujiConfig.blockMedalLevel"
                              :min="0"
                              placeholder="0 表示不过滤"
                            />
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <NGrid
                        :x-gap="12"
                        :y-gap="8"
                        :cols="2"
                      >
                        <NGi>
                          <NFormItem
                            label="屏蔽关键词 (每行一个)"
                            path="blockKeywords"
                          >
                            <NInput
                              v-model:value="danmujiConfig.blockKeywords"
                              type="textarea"
                              :rows="3"
                              placeholder="输入屏蔽词..."
                            />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem
                            label="屏蔽用户 (每行一个用户名)"
                            path="blockUsers"
                          >
                            <NInput
                              v-model:value="danmujiConfig.blockUsers"
                              type="textarea"
                              :rows="3"
                              placeholder="输入用户名..."
                            />
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">高级发音</div>
                      <NFormItem
                        label="礼物用户名发音模板"
                        path="giftUsernamePronunciation"
                      >
                        <NInput
                          v-model:value="danmujiConfig.giftUsernamePronunciation"
                          placeholder="例如：{name} 送出了 {gift}"
                        />
                      </NFormItem>
                    </NForm>
                  </NCard>
                </div>
              </NTabPane>

              <!-- 消息调试 Tab -->
              <NTabPane
                name="test"
                tab="消息调试"
              >
                <div class="config-scroll-container">
                  <NCard
                    :bordered="false"
                    size="small"
                  >
                    <NForm
                      :model="testFormData"
                      label-placement="top"
                      size="small"
                    >
                      <NCard
                        size="small"
                        title="自动弹幕模拟器"
                        embedded
                        style="margin-bottom: 16px"
                      >
                        <template #header-extra>
                          <NSwitch
                            v-model:value="isAutoGenerating"
                            size="small"
                          >
                            <template #checked> 模拟中 </template>
                            <template #unchecked> 已暂停 </template>
                          </NSwitch>
                        </template>

                        <NFlex
                          align="center"
                          justify="space-between"
                        >
                          <NFlex align="center">
                            <span style="font-size: 12px; color: var(--vtsuru-fg-muted)">发送间隔:</span>
                            <NInputNumber
                              v-model:value="autoGenerateInterval"
                              :min="0.5"
                              :max="10"
                              :step="0.5"
                              size="tiny"
                              style="width: 100px"
                              :disabled="!isAutoGenerating"
                            >
                              <template #suffix> 秒 </template>
                            </NInputNumber>
                          </NFlex>

                          <NTag
                            :type="isAutoGenerating ? 'success' : 'default'"
                            size="small"
                            round
                          >
                            {{ isAutoGenerating ? '正在持续推流' : '未启动' }}
                          </NTag>
                        </NFlex>
                      </NCard>

                      <div class="form-section-title">单条手动发送</div>

                      <NGrid
                        :x-gap="12"
                        :y-gap="10"
                        :cols="2"
                      >
                        <NGi :span="2">
                          <NFormItem
                            label="消息类型"
                            path="type"
                          >
                            <NSelect
                              v-model:value="testFormData.type"
                              :options="messageTypeOptions"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi>
                          <NFormItem
                            label="用户名"
                            path="uname"
                          >
                            <NInput
                              v-model:value="testFormData.uname"
                              placeholder="测试用户"
                            />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem
                            label="用户 ID"
                            path="uid"
                          >
                            <NInputNumber
                              v-model:value="testFormData.uid"
                              :show-button="false"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi
                          v-if="testFormData.type === EventDataTypes.Message || testFormData.type === EventDataTypes.SC"
                          :span="2"
                        >
                          <NFormItem
                            label="消息内容"
                            path="msg"
                          >
                            <NInput
                              v-model:value="testFormData.msg"
                              type="textarea"
                              :rows="2"
                              placeholder="输入消息内容..."
                            />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Gift">
                          <NFormItem
                            label="礼物名称"
                            path="msg"
                          >
                            <NInput v-model:value="testFormData.msg" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Gift">
                          <NFormItem
                            label="数量"
                            path="num"
                          >
                            <NInputNumber
                              v-model:value="testFormData.num"
                              :min="1"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi
                          v-if="testFormData.type === EventDataTypes.Gift || testFormData.type === EventDataTypes.SC"
                        >
                          <NFormItem
                            label="价值 (元)"
                            path="price"
                          >
                            <NInputNumber
                              v-model:value="testFormData.price"
                              :min="0"
                              :precision="1"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi
                          v-if="
                            testFormData.type === EventDataTypes.Guard || testFormData.type === EventDataTypes.Message
                          "
                        >
                          <NFormItem
                            label="舰长身份"
                            path="guard_level"
                          >
                            <NSelect
                              v-model:value="testFormData.guard_level"
                              :options="guardLevelOptions"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Message">
                          <NFormItem
                            label="粉丝牌等级"
                            path="fans_medal_level"
                          >
                            <NInputNumber
                              v-model:value="testFormData.fans_medal_level"
                              :min="0"
                            />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Message">
                          <NFormItem
                            label="粉丝牌名称"
                            path="fans_medal_name"
                          >
                            <NInput v-model:value="testFormData.fans_medal_name" />
                          </NFormItem>
                        </NGi>

                        <NGi
                          v-if="testFormData.type === EventDataTypes.SCDel"
                          :span="2"
                        >
                          <NFormItem
                            label="要删除的 SC ID"
                            path="sc_id_to_delete"
                          >
                            <NInput
                              v-model:value="testFormData.sc_id_to_delete"
                              placeholder="输入 SC ID..."
                            />
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div style="margin-top: 14px">
                        <NGrid
                          :x-gap="12"
                          :cols="2"
                        >
                          <NGi>
                            <NButton
                              block
                              secondary
                              @click="generateRandomContent"
                            >
                              <template #icon><NIcon :component="Sparkle24Regular" /></template>
                              随机填充内容
                            </NButton>
                          </NGi>
                          <NGi>
                            <NButton
                              block
                              type="primary"
                              @click="sendTestMessage"
                            >
                              <template #icon><NIcon :component="Send24Regular" /></template>
                              发送测试消息
                            </NButton>
                          </NGi>
                        </NGrid>
                      </div>
                    </NForm>
                  </NCard>
                </div>
              </NTabPane>
            </NTabs>
          </NFlex>
        </div>
      </template>

      <!-- 右侧预览区 -->
      <template #2>
        <div class="right-panel-container">
          <div class="preview-window">
            <div class="preview-toolbar">
              <div class="window-controls">
                <div class="dot red" />
                <div class="dot yellow" />
                <div class="dot green" />
              </div>
              <div class="address-bar">OBS 弹幕机实时效果预览</div>

              <!-- 背景模拟切换 -->
              <div class="bg-switch-group">
                <NRadioGroup
                  v-model:value="previewBgMode"
                  size="small"
                >
                  <NRadioButton value="transparent">透明网格</NRadioButton>
                  <NRadioButton value="dark">纯黑</NRadioButton>
                  <NRadioButton value="light">纯白</NRadioButton>
                  <NRadioButton value="game">游戏底图</NRadioButton>
                </NRadioGroup>
              </div>
            </div>

            <div
              class="preview-content"
              :class="`bg-${previewBgMode}`"
            >
              <DanmujiOBS
                ref="danmujiObsRef"
                :is-o-b-s="false"
                style="height: 100%; width: 100%"
                :custom-css="css"
                :config="danmujiConfig"
                :open-live-auth="openLiveAuth"
              />
            </div>
          </div>
        </div>
      </template>
    </NSplit>
  </div>
</template>

<style scoped>
.danmuji-manage-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--vtsuru-header-height) - var(--vtsuru-content-padding) - 20px);
  width: 100%;
  overflow: hidden;
}

.danmuji-split {
  flex: 1;
  min-height: 0;
}

.left-panel-scroll-container {
  height: 100%;
  overflow-y: auto;
  background-color: var(--vtsuru-bg-elevated);
}

.obs-link-card {
  flex-shrink: 0;
  border-radius: 8px;
}

.obs-label {
  display: flex;
  flex-direction: column;
  margin-right: 12px;
}

.label-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.label-desc {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.obs-source-guide {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--vtsuru-border);
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.obs-source-guide summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--vtsuru-fg);
  user-select: none;
}

.obs-source-guide ol {
  margin: 6px 0 0;
  padding-left: 18px;
  line-height: 1.6;
}

.main-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  gap: 10px;
}



.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.css-transparency-alert {
  padding: 6px 12px;
  font-size: 12px;
}

.editor-container {
  flex: 1;
  min-height: 360px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  overflow: hidden;
}

.config-scroll-container {
  height: 100%;
  overflow-y: auto;
}

.form-section-title {
  margin: 14px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.checkbox-card {
  border-radius: 6px;
}

.right-panel-container {
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.preview-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--vtsuru-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgb(0 0 0 / 18%);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--vtsuru-bg-elevated);
  border-bottom: 1px solid var(--vtsuru-border);
}

.window-controls {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.red {
  background: #ff5f56;
}
.dot.yellow {
  background: #ffbd2e;
}
.dot.green {
  background: #27c93f;
}

.address-bar {
  font-size: 12px;
  font-weight: 500;
  color: var(--vtsuru-fg-muted);
}

.preview-content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transition: background 0.2s ease;
}

.preview-content.bg-transparent {
  background-image: linear-gradient(45deg, #23272e 25%, transparent 25%),
    linear-gradient(-45deg, #23272e 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #23272e 75%),
    linear-gradient(-45deg, transparent 75%, #23272e 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-color: #1a1d23;
}

.preview-content.bg-dark {
  background-color: #121214;
}

.preview-content.bg-light {
  background-color: #ffffff;
}

.preview-content.bg-game {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #0f2027 100%);
}
</style>
