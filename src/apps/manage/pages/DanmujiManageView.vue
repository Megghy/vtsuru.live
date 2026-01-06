<script setup lang="ts">
import type { DanmujiConfig } from '@/apps/obs/pages/DanmujiOBS.vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NCheckbox,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NPopconfirm,
  NSelect,
  NSpace,
  NSplit,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'
import MonacoEditorComponent from '@/apps/manage/components/MonacoEditorComponent.vue'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { CURRENT_HOST } from '@/shared/config'
import { defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'
import { isDarkMode } from '@/shared/utils'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'

const accountInfo = useAccount()
const css = useStorage('danmuji-css', defaultDanmujiCss)
const danmujiObsRef = ref<InstanceType<typeof DanmujiOBS> | null>(null)
const message = useMessage()
const windowWidth = useWindowSize().width

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
  return `测试用户${randomDigits(5)}`
}

function generateTestMessage() {
  const templates = [
    '测试消息',
    '这是一条测试消息',
    '测试弹幕内容',
    '系统测试消息',
    '模拟展示消息',
  ]
  const template = templates[Math.floor(Math.random() * templates.length)]
  return `${template}${randomDigits(4)}`
}

function generateTestGiftName() {
  return `测试礼物${randomDigits(3)}`
}

function generateTestMedalName() {
  return `测试粉丝牌${randomDigits(3)}`
}

// 保存DanmujiConfig的配置
const danmujiConfig = useStorage<DanmujiConfig>('danmuji-config', {
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

// 修改为使用标签页的活动键存储
const activeTab = useStorage('danmuji-active-tab', 'style')

// 自动生成弹幕设置
const isAutoGenerating = ref(true)
const autoGenerateInterval = ref(1) // 默认间隔3秒
let autoGenerateTimer: ReturnType<typeof setTimeout> | null = null

// 自动生成弹幕的独立数据对象，不影响表单
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

// 重设CSS为默认值
function resetCssToDefault() {
  css.value = defaultDanmujiCss
}

// 重设配置为默认值
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
  message.success('配置已重置为默认值')
}

// 随机生成测试弹幕内容
function generateRandomContent() {
  // 随机生成用户名
  testFormData.uname = generateTestUsername()

  // 随机生成用户ID (10000-99999)
  testFormData.uid = Math.floor(Math.random() * 90000) + 10000

  // 根据消息类型随机生成相应内容
  switch (testFormData.type) {
    case EventDataTypes.Message: {
      // 随机弹幕内容
      testFormData.msg = generateTestMessage()
      // 随机粉丝牌等级 (0-30)
      testFormData.fans_medal_level = Math.floor(Math.random() * 31)
      // 随机粉丝牌名称
      testFormData.fans_medal_name = generateTestMedalName()
      // 随机舰长等级
      const guardRandomIndex = Math.floor(Math.random() * guardLevelOptions.length)
      testFormData.guard_level = guardLevelOptions[guardRandomIndex].value
      break
    }

    case EventDataTypes.Gift:
      // 随机礼物名称
      testFormData.msg = generateTestGiftName()
      // 随机礼物数量 (1-99)
      testFormData.num = Math.floor(Math.random() * 99) + 1
      // 随机礼物价值 (1-50)
      testFormData.price = Math.floor(Math.random() * 50) + 1
      break

    case EventDataTypes.Guard: {
      // 随机舰长等级 (排除非舰长选项)
      const guardOptions = guardLevelOptions.filter(option => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      testFormData.guard_level = guardOptions[guardIndex].value
      break
    }

    case EventDataTypes.SC:
      // 随机SC内容
      testFormData.msg = generateTestMessage()
      // 随机SC价格 (5-500)
      testFormData.price = Math.floor(Math.random() * 496) + 5
      break

    case EventDataTypes.SCDel:
      // 生成一个假的SC ID
      testFormData.sc_id_to_delete = `test-sc-${Date.now() - Math.floor(Math.random() * 10000)}`
      break
  }
}

function sendTestMessage() {
  if (!danmujiObsRef.value) {
    console.error('DanmujiOBS component instance not found.')
    return
  }

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

// 添加初始测试数据
function addInitialTestMessages() {
  if (!danmujiObsRef.value) return

  // 延迟执行，确保组件已完全渲染
  setTimeout(() => {
    // 添加普通弹幕消息
    for (let i = 0; i < 5; i++) {
      autoGenData.type = EventDataTypes.Message
      generateAutoContent()
      sendAutoMessage()
    }

    // 添加礼物消息
    autoGenData.type = EventDataTypes.Gift
    generateAutoContent()
    sendAutoMessage()

    // 添加舰长消息
    autoGenData.type = EventDataTypes.Guard
    generateAutoContent()
    sendAutoMessage()

    // 添加SC消息
    autoGenData.type = EventDataTypes.SC
    generateAutoContent()
    sendAutoMessage()
  }, 500)
}

// 开始自动生成弹幕
function startAutoGenerate() {
  if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
  }

  if (!isAutoGenerating.value) return

  // 生成随机消息类型
  const messageTypes = [
    EventDataTypes.Message,
    EventDataTypes.Gift,
    EventDataTypes.Guard,
    EventDataTypes.SC,
  ]

  // 50%概率为普通弹幕，50%概率为其他类型
  autoGenData.type = Math.random() < 0.5
    ? EventDataTypes.Message
    : messageTypes[Math.floor(Math.random() * messageTypes.length)]

  // 为自动生成数据随机生成内容
  generateAutoContent()

  // 发送自动生成的消息
  sendAutoMessage()

  // 随机间隔时间（基础间隔的50%-150%）
  const randomInterval = autoGenerateInterval.value * (0.5 + Math.random())
  autoGenerateTimer = setTimeout(startAutoGenerate, randomInterval * 1000)
}

// 为自动生成弹幕生成随机内容
function generateAutoContent() {
  // 随机生成用户名
  autoGenData.uname = generateTestUsername()

  // 随机生成用户ID (10000-99999)
  autoGenData.uid = Math.floor(Math.random() * 90000) + 10000

  // 根据消息类型随机生成相应内容
  switch (autoGenData.type) {
    case EventDataTypes.Message: {
      // 随机弹幕内容
      autoGenData.msg = generateTestMessage()
      // 随机粉丝牌等级 (0-30)
      autoGenData.fans_medal_level = Math.floor(Math.random() * 31)
      // 随机粉丝牌名称
      autoGenData.fans_medal_name = generateTestMedalName()
      // 随机舰长等级
      const guardRandomIndex = Math.floor(Math.random() * guardLevelOptions.length)
      autoGenData.guard_level = guardLevelOptions[guardRandomIndex].value
      break
    }

    case EventDataTypes.Gift:
      // 随机礼物名称
      autoGenData.msg = generateTestGiftName()
      // 随机礼物数量 (1-99)
      autoGenData.num = Math.floor(Math.random() * 99) + 1
      // 随机礼物价值 (1-50)
      autoGenData.price = Math.floor(Math.random() * 50) + 1
      break

    case EventDataTypes.Guard: {
      // 随机舰长等级 (排除非舰长选项)
      const guardOptions = guardLevelOptions.filter(option => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      autoGenData.guard_level = guardOptions[guardIndex].value
      break
    }

    case EventDataTypes.SC:
      // 随机SC内容
      autoGenData.msg = generateTestMessage()
      // 随机SC价格 (5-500)
      autoGenData.price = Math.floor(Math.random() * 496) + 5
      break
  }
}

// 发送自动生成的消息
function sendAutoMessage() {
  if (!danmujiObsRef.value) {
    console.error('DanmujiOBS component instance not found.')
    return
  }

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

// 监听自动生成状态变化
watch(isAutoGenerating, (newValue) => {
  if (newValue) {
    startAutoGenerate()
  } else if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
    autoGenerateTimer = null
  }
}, { immediate: true })

// 从服务器获取配置
async function downloadConfigFromServer() {
  const result = await DownloadConfig<DanmujiConfig>('danmuji-config')
  if (result.status === 'success' && result.data) {
    danmujiConfig.value = result.data
    message.success('已从服务器获取弹幕姬配置')
    return true
  } else if (result.status === 'notfound') {
    // message.info('服务器上未找到弹幕姬配置，将使用本地配置');
    uploadConfigToServer()
  } else {
    message.error(`获取配置失败: ${result.msg}`)
  }
  return false
}

// 组件挂载后添加初始测试数据
onMounted(async () => {
  // 先尝试从服务器获取配置
  await downloadConfigFromServer()

  // 添加初始测试数据
  addInitialTestMessages()

  // 确保在添加初始测试数据后启动自动生成
  setTimeout(() => {
    if (isAutoGenerating.value && !autoGenerateTimer) {
      startAutoGenerate()
    }
  }, 1000)
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
    autoGenerateTimer = null
  }
})

// 上传配置到服务器
async function uploadConfigToServer() {
  const result = await UploadConfig('danmuji-config', danmujiConfig.value)
  if (result) {
    message.success('弹幕姬配置已上传到服务器')
  } else {
    message.error('上传弹幕姬配置失败')
  }
}

function copyObsUrl() {
  const url = `${CURRENT_HOST}obs/danmuji?token=${accountInfo.value.token}`
  navigator.clipboard.writeText(url).then(() => {
    message.success('OBS 地址已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}
</script>

<template>
  <div class="danmuji-manage-container">
    <NSplit
      class="danmuji-split"
      :direction="windowWidth < 768 ? 'vertical' : 'horizontal'"
      :min="0.3"
      :max="0.7"
      :default-size="0.4"
    >
      <template #1>
        <div class="left-panel-scroll-container">
          <NFlex
            vertical
            style="padding: 16px; height: 100%; box-sizing: border-box;"
            :size="16"
          >
            <!-- 顶部连接信息，更加紧凑 -->
            <NCard size="small" embedded class="obs-link-card">
              <NFlex align="center" justify="space-between" :wrap="false">
                <div class="obs-label">
                  <span class="label-text">OBS Studio 地址</span>
                  <span class="label-desc">在 OBS 浏览器源中填入此地址</span>
                </div>
                <NInput
                  size="small"
                  readonly
                  :allow-input="() => false"
                  :value="`${CURRENT_HOST}obs/danmuji?token=${accountInfo.token}`"
                  style="flex: 1; max-width: 400px;"
                >
                  <template #suffix>
                    <NButton text type="primary" size="tiny" @click="copyObsUrl">
                      复制
                    </NButton>
                  </template>
                </NInput>
              </NFlex>
            </NCard>

            <NTabs
              v-model:value="activeTab"
              type="segment"
              animated
              class="main-tabs"
              style="flex: 1; display: flex; flex-direction: column;"
              pane-style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"
            >
              <NTabPane
                name="style"
                tab="样式定制"
              >
                <div class="tab-content-wrapper">
                  <div class="editor-header">
                    <span class="editor-title">自定义 CSS</span>
                    <NPopconfirm @positive-click="resetCssToDefault">
                      <template #trigger>
                        <NButton size="small" type="warning" secondary>
                          重设为默认
                        </NButton>
                      </template>
                      确定要重设为默认CSS吗？这将清除所有自定义样式。
                    </NPopconfirm>
                  </div>
                  <div class="editor-container">
                    <MonacoEditorComponent
                      v-model:value="css"
                      language="css"
                      style="height: 100%; width: 100%;"
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
                          verticalScrollbarSize: 10,
                          horizontalScrollbarSize: 10,
                        },
                      }"
                      :theme="isDarkMode ? 'vs-dark' : 'vs'"
                    />
                  </div>
                </div>
              </NTabPane>

              <NTabPane
                name="config"
                tab="功能配置"
              >
                <div class="config-scroll-container">
                  <NCard :bordered="false" size="small">
                    <template #header>
                      <NFlex justify="space-between" align="center">
                        <span>基本设置</span>
                        <NSpace>
                          <NButton size="small" type="primary" secondary @click="uploadConfigToServer">
                            保存到云端
                          </NButton>
                          <NPopconfirm @positive-click="resetConfigToDefault">
                            <template #trigger>
                              <NButton size="small" type="error" secondary>
                                重置
                              </NButton>
                            </template>
                            确定要重设为默认配置吗？
                          </NPopconfirm>
                        </NSpace>
                      </NFlex>
                    </template>
                    
                    <NForm
                      :model="danmujiConfig"
                      label-placement="top"
                      label-width="auto"
                      require-mark-placement="right-hanging"
                      size="small"
                    >
                      <div class="form-section-title">
                        显示设置
                      </div>
                      <NGrid :x-gap="12" :y-gap="8" :cols="3">
                        <NGi>
                          <NCard size="small" embedded class="checkbox-card">
                            <NCheckbox v-model:checked="danmujiConfig.showDanmaku">
                              显示弹幕消息
                            </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard size="small" embedded class="checkbox-card">
                            <NCheckbox v-model:checked="danmujiConfig.showGift">
                              显示礼物消息
                            </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard size="small" embedded class="checkbox-card">
                            <NCheckbox v-model:checked="danmujiConfig.showGiftName">
                              显示礼物名称
                            </NCheckbox>
                          </NCard>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">
                        合并策略
                      </div>
                      <NGrid :x-gap="12" :y-gap="8" :cols="2">
                        <NGi>
                          <NCard size="small" embedded class="checkbox-card">
                            <NCheckbox v-model:checked="danmujiConfig.mergeSimilarDanmaku">
                              合并相似弹幕
                            </NCheckbox>
                          </NCard>
                        </NGi>
                        <NGi>
                          <NCard size="small" embedded class="checkbox-card">
                            <NCheckbox v-model:checked="danmujiConfig.mergeGift">
                              合并礼物消息
                            </NCheckbox>
                          </NCard>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">
                        阈值控制
                      </div>
                      <NGrid :x-gap="12" :y-gap="8" :cols="2">
                        <NGi>
                          <NFormItem label="最大消息积压数" path="maxNumber">
                            <NInputNumber v-model:value="danmujiConfig.maxNumber" :min="10" :max="200" />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem label="最低显示礼物价值" path="minGiftPrice">
                            <NInputNumber v-model:value="danmujiConfig.minGiftPrice" :min="0" :step="0.1">
                              <template #suffix>
                                元
                              </template>
                            </NInputNumber>
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">
                        过滤规则
                      </div>
                      <NGrid :x-gap="12" :y-gap="8" :cols="2">
                        <NGi>
                          <NFormItem label="屏蔽舰长等级低于" path="blockLevel">
                            <NSelect v-model:value="danmujiConfig.blockLevel" :options="guardLevelOptions" />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem label="屏蔽粉丝牌等级低于" path="blockMedalLevel">
                            <NInputNumber v-model:value="danmujiConfig.blockMedalLevel" :min="0" placeholder="0表示不过滤" />
                          </NFormItem>
                        </NGi>
                      </NGrid>
                      
                      <NGrid :x-gap="12" :y-gap="8" :cols="2">
                        <NGi>
                          <NFormItem label="屏蔽关键词 (每行一个)" path="blockKeywords">
                            <NInput
                              v-model:value="danmujiConfig.blockKeywords"
                              type="textarea"
                              :rows="3"
                              placeholder="输入关键词..."
                            />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem label="屏蔽用户 (每行一个)" path="blockUsers">
                            <NInput
                              v-model:value="danmujiConfig.blockUsers"
                              type="textarea"
                              :rows="3"
                              placeholder="输入用户名..."
                            />
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div class="form-section-title">
                        高级设置
                      </div>
                      <NFormItem label="礼物用户名发音规则" path="giftUsernamePronunciation">
                        <NInput v-model:value="danmujiConfig.giftUsernamePronunciation" placeholder="例如：{name} 送出了 {gift}" />
                      </NFormItem>
                    </NForm>
                  </NCard>
                </div>
              </NTabPane>

              <NTabPane
                name="test"
                tab="消息调试"
              >
                <div class="config-scroll-container">
                  <NCard :bordered="false" size="small">
                    <NForm
                      :model="testFormData"
                      label-placement="top"
                      size="small"
                    >
                      <NCard size="small" title="自动模拟" embedded style="margin-bottom: 16px;">
                        <template #header-extra>
                          <NSwitch v-model:value="isAutoGenerating" size="small">
                            <template #checked>
                              运行中
                            </template>
                            <template #unchecked>
                              已停止
                            </template>
                          </NSwitch>
                        </template>
                        <NFlex align="center">
                          <span style="font-size: 12px; color: var(--n-text-color-3);">生成间隔:</span>
                          <NInputNumber
                            v-model:value="autoGenerateInterval"
                            :min="0.5" :max="10" :step="0.5"
                            size="tiny"
                            style="width: 100px;"
                            :disabled="!isAutoGenerating"
                          >
                            <template #suffix>
                              秒
                            </template>
                          </NInputNumber>
                        </NFlex>
                      </NCard>

                      <div class="form-section-title">
                        手动发送
                      </div>
                      
                      <NGrid :x-gap="12" :y-gap="12" :cols="2">
                        <NGi :span="2">
                          <NFormItem label="消息类型" path="type">
                            <NSelect v-model:value="testFormData.type" :options="messageTypeOptions" />
                          </NFormItem>
                        </NGi>
                         
                        <NGi>
                          <NFormItem label="用户名" path="uname">
                            <NInput v-model:value="testFormData.uname" placeholder="测试用户" />
                          </NFormItem>
                        </NGi>
                        <NGi>
                          <NFormItem label="用户ID" path="uid">
                            <NInputNumber v-model:value="testFormData.uid" :show-button="false" />
                          </NFormItem>
                        </NGi>

                        <!-- 动态内容区域 -->
                        <NGi v-if="testFormData.type === EventDataTypes.Message || testFormData.type === EventDataTypes.SC" :span="2">
                          <NFormItem label="消息内容" path="msg">
                            <NInput v-model:value="testFormData.msg" type="textarea" :rows="2" placeholder="输入消息内容..." />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Gift">
                          <NFormItem label="礼物名称" path="msg">
                            <NInput v-model:value="testFormData.msg" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Gift">
                          <NFormItem label="数量" path="num">
                            <NInputNumber v-model:value="testFormData.num" :min="1" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Gift || testFormData.type === EventDataTypes.SC">
                          <NFormItem label="价值 (元)" path="price">
                            <NInputNumber v-model:value="testFormData.price" :min="0" :precision="1" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Guard || testFormData.type === EventDataTypes.Message">
                          <NFormItem label="舰长身份" path="guard_level">
                            <NSelect v-model:value="testFormData.guard_level" :options="guardLevelOptions" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Message">
                          <NFormItem label="粉丝牌等级" path="fans_medal_level">
                            <NInputNumber v-model:value="testFormData.fans_medal_level" :min="0" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.Message">
                          <NFormItem label="粉丝牌名称" path="fans_medal_name">
                            <NInput v-model:value="testFormData.fans_medal_name" />
                          </NFormItem>
                        </NGi>

                        <NGi v-if="testFormData.type === EventDataTypes.SCDel" :span="2">
                          <NFormItem label="目标 SC ID" path="sc_id_to_delete">
                            <NInput v-model:value="testFormData.sc_id_to_delete" />
                          </NFormItem>
                        </NGi>
                      </NGrid>

                      <div style="margin-top: 24px;">
                        <NGrid :x-gap="12" :cols="2">
                          <NGi>
                            <NButton block secondary type="info" @click="generateRandomContent">
                              🎲 随机填充
                            </NButton>
                          </NGi>
                          <NGi>
                            <NButton block type="primary" @click="sendTestMessage">
                              📨 发送消息
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

      <template #2>
        <div class="right-panel-container">
          <div class="preview-window">
            <div class="preview-toolbar">
              <div class="window-controls">
                <div class="dot red" />
                <div class="dot yellow" />
                <div class="dot green" />
              </div>
              <div class="address-bar">
                OBS Live Chat Preview
              </div>
              <div class="toolbar-actions">
                <!-- 可以在这里放一些快捷开关，比如透明背景切换等 -->
              </div>
            </div>
            
            <div class="preview-content">
              <DanmujiOBS
                ref="danmujiObsRef"
                :is-o-b-s="false"
                style="height: 100%; width: 100%;"
                :custom-css="css"
                :config="danmujiConfig"
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
  background-color: var(--n-color);
}

.obs-link-card {
  flex-shrink: 0;
}

.obs-label {
  display: flex;
  flex-direction: column;
  margin-right: 12px;
}

.label-text {
  font-weight: 500;
}

.label-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.main-tabs {
  height: 100%;
}

.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.editor-title {
  font-weight: 500;
}

.editor-container {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.config-scroll-container {
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
  padding-top: 4px;
}

/* 隐藏滚动条但保持可滚动 (Webkit) */
.config-scroll-container::-webkit-scrollbar {
  width: 6px;
}
.config-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
.config-scroll-container::-webkit-scrollbar-track {
  background-color: transparent;
}

.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color-2);
  margin-top: 16px;
  margin-bottom: 8px;
  padding-left: 4px;
  border-left: 3px solid var(--n-primary-color);
  line-height: 1;
}
.form-section-title:first-child {
  margin-top: 0;
}

.checkbox-card {
  cursor: pointer;
  transition: all 0.2s;
}
.checkbox-card:hover {
  background-color: var(--n-action-color);
}

.right-panel-container {
  height: 100%;
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
  background-color: var(--n-color-embedded);
  display: flex;
  flex-direction: column;
}

.preview-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a; /* 默认深色背景，模拟OBS */
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}

.preview-toolbar {
  height: 36px;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #3d3d3d;
}

.window-controls {
  display: flex;
  gap: 6px;
  margin-right: 16px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.address-bar {
  flex: 1;
  background: #1a1a1a;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #888;
  user-select: none;
}

.preview-content {
  flex: 1;
  min-height: 0;
  position: relative;
  /* 棋盘格背景 */
  background-color: #1a1a1a;
  background-image:
    linear-gradient(45deg, #222 25%, transparent 25%),
    linear-gradient(-45deg, #222 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #222 75%),
    linear-gradient(-45deg, transparent 75%, #222 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

:deep(.n-card-header) {
  padding: 12px 16px 8px 16px;
}
:deep(.n-card__content) {
  padding: 0 16px 12px 16px;
}
</style>
