<script setup lang="ts">
import type { DanmujiConfig } from '../obs/DanmujiOBS.vue'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
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
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { CURRENT_HOST, defaultDanmujiCss } from '@/data/constants'
import { isDarkMode } from '@/Utils'
import DanmujiOBS from '../obs/DanmujiOBS.vue'

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
    case EventDataTypes.Message:
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

    case EventDataTypes.Gift:
      // 随机礼物名称
      testFormData.msg = generateTestGiftName()
      // 随机礼物数量 (1-99)
      testFormData.num = Math.floor(Math.random() * 99) + 1
      // 随机礼物价值 (1-50)
      testFormData.price = Math.floor(Math.random() * 50) + 1
      break

    case EventDataTypes.Guard:
      // 随机舰长等级 (排除非舰长选项)
      const guardOptions = guardLevelOptions.filter(option => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      testFormData.guard_level = guardOptions[guardIndex].value
      break

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
    case EventDataTypes.Message:
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

    case EventDataTypes.Gift:
      // 随机礼物名称
      autoGenData.msg = generateTestGiftName()
      // 随机礼物数量 (1-99)
      autoGenData.num = Math.floor(Math.random() * 99) + 1
      // 随机礼物价值 (1-50)
      autoGenData.price = Math.floor(Math.random() * 50) + 1
      break

    case EventDataTypes.Guard:
      // 随机舰长等级 (排除非舰长选项)
      const guardOptions = guardLevelOptions.filter(option => option.value !== GuardLevel.None)
      const guardIndex = Math.floor(Math.random() * guardOptions.length)
      autoGenData.guard_level = guardOptions[guardIndex].value
      break

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
</script>

<template>
  <div class="danmuji-manage-container">
    <NSplit
      class="danmuji-split"
      :direction="windowWidth < 768 ? 'vertical' : 'horizontal'"
      :min="0.25"
      :max="0.75"
    >
      <template #1>
        <div class="left-panel-scroll-container">
          <NFlex
            vertical
            style="padding-right: 12px;"
          >
            <NCard title="OBS Studio 地址">
              <NInput
                readonly
                :allow-input="() => false"
                :value="`${CURRENT_HOST}obs/danmuji?token=${accountInfo.token}`"
              />
            </NCard>

            <NTabs
              v-model:value="activeTab"
              type="line"
              animated
              style="min-height: 500px;"
            >
              <NTabPane
                name="style"
                tab="样式设置"
              >
                <NCard
                  title="自定义 CSS"
                  style="min-height: 450px;"
                >
                  <template #header-extra>
                    <NPopconfirm
                      @positive-click="resetCssToDefault"
                    >
                      <template #trigger>
                        <NButton
                          size="small"
                          type="warning"
                        >
                          重设为默认CSS
                        </NButton>
                      </template>
                      确定要重设为默认CSS吗？这将清除所有自定义样式。
                    </NPopconfirm>
                  </template>
                  <MonacoEditorComponent
                    v-model:value="css"
                    language="css"
                    style="height: 400px; width: 100%;"
                    :options="{
                      minimap: {
                        enabled: false,
                      },
                      fontSize: 14,
                      automaticLayout: true,
                      formatOnPaste: true,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      tabSize: 2,
                      bracketPairColorization: {
                        enabled: true,
                      },
                      guides: {
                        bracketPairs: true,
                        indentation: true,
                      },
                      autoIndent: 'full',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      folding: true,
                      autoClosingBrackets: 'always',
                      autoClosingQuotes: 'always',
                      renderWhitespace: 'selection',
                      glyphMargin: false,
                      quickSuggestions: true,
                      colorDecorators: true,
                      scrollbar: {
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                      },
                    }"
                    :theme="isDarkMode ? 'vs-dark' : 'vs'"
                  />
                </NCard>
              </NTabPane>

              <NTabPane
                name="config"
                tab="弹幕姬配置"
              >
                <NCard title="基本设置">
                  <template #header-extra>
                    <NSpace>
                      <NButton
                        size="small"
                        type="info"
                        @click="uploadConfigToServer"
                      >
                        保存到服务器
                      </NButton>
                      <NPopconfirm
                        @positive-click="resetConfigToDefault"
                      >
                        <template #trigger>
                          <NButton
                            size="small"
                            type="warning"
                          >
                            重设为默认配置
                          </NButton>
                        </template>
                        确定要重设为默认配置吗？
                      </NPopconfirm>
                    </NSpace>
                  </template>
                  <NForm
                    :model="danmujiConfig"
                    label-placement="left"
                    label-width="auto"
                    require-mark-placement="right-hanging"
                  >
                    <NDivider>显示设置</NDivider>
                    <NFlex justify="space-between">
                      <NCheckbox v-model:checked="danmujiConfig.showDanmaku">
                        显示弹幕消息
                      </NCheckbox>
                      <NCheckbox v-model:checked="danmujiConfig.showGift">
                        显示礼物消息
                      </NCheckbox>
                      <NCheckbox v-model:checked="danmujiConfig.showGiftName">
                        显示礼物名称
                      </NCheckbox>
                    </NFlex>

                    <NDivider>合并设置</NDivider>
                    <NFlex justify="space-between">
                      <NCheckbox v-model:checked="danmujiConfig.mergeSimilarDanmaku">
                        合并相似弹幕
                      </NCheckbox>
                      <NCheckbox v-model:checked="danmujiConfig.mergeGift">
                        合并礼物消息
                      </NCheckbox>
                    </NFlex>

                    <NDivider>容量设置</NDivider>
                    <NFormItem
                      label="最大消息数量"
                      path="maxNumber"
                    >
                      <NInputNumber
                        v-model:value="danmujiConfig.maxNumber"
                        :min="10"
                        :max="200"
                      />
                    </NFormItem>
                    <NFormItem
                      label="最低礼物价值"
                      path="minGiftPrice"
                    >
                      <NInputNumber
                        v-model:value="danmujiConfig.minGiftPrice"
                        :min="0"
                        :step="0.1"
                      >
                        <template #suffix>
                          元
                        </template>
                      </NInputNumber>
                    </NFormItem>

                    <NDivider>过滤设置</NDivider>
                    <NFormItem
                      label="屏蔽舰长等级以下"
                      path="blockLevel"
                    >
                      <NSelect
                        v-model:value="danmujiConfig.blockLevel"
                        :options="guardLevelOptions"
                      />
                    </NFormItem>
                    <NFormItem
                      label="屏蔽粉丝牌等级"
                      path="blockMedalLevel"
                    >
                      <NInputNumber
                        v-model:value="danmujiConfig.blockMedalLevel"
                        :min="0"
                        placeholder="0表示不过滤"
                      />
                    </NFormItem>
                    <NFormItem
                      label="屏蔽关键词"
                      path="blockKeywords"
                    >
                      <NInput
                        v-model:value="danmujiConfig.blockKeywords"
                        type="textarea"
                        placeholder="每行一个关键词"
                      />
                    </NFormItem>
                    <NFormItem
                      label="屏蔽用户"
                      path="blockUsers"
                    >
                      <NInput
                        v-model:value="danmujiConfig.blockUsers"
                        type="textarea"
                        placeholder="每行一个用户名"
                      />
                    </NFormItem>

                    <NDivider>发音设置</NDivider>
                    <NFormItem
                      label="礼物用户名发音"
                      path="giftUsernamePronunciation"
                    >
                      <NInput
                        v-model:value="danmujiConfig.giftUsernamePronunciation"
                        placeholder="礼物用户名发音规则"
                      />
                    </NFormItem>
                  </NForm>
                </NCard>
              </NTabPane>

              <NTabPane
                name="test"
                tab="发送测试消息"
              >
                <NCard title="发送测试消息">
                  <NForm
                    :model="testFormData"
                    label-placement="left"
                    label-width="auto"
                    require-mark-placement="right-hanging"
                  >
                    <NFlex
                      justify="space-between"
                      align="center"
                      style="margin-bottom: 12px;"
                    >
                      <NSpace align="center">
                        <span>自动生成弹幕:</span>
                        <NSwitch v-model:value="isAutoGenerating" />
                      </NSpace>

                      <NSpace
                        v-if="isAutoGenerating"
                        align="center"
                      >
                        <span>间隔时间:</span>
                        <NInputNumber
                          v-model:value="autoGenerateInterval"
                          :min="0.5"
                          :max="10"
                          :step="0.5"
                          style="width: 90px;"
                        >
                          <template #suffix>
                            秒
                          </template>
                        </NInputNumber>
                      </NSpace>
                    </NFlex>

                    <NFormItem
                      label="消息类型"
                      path="type"
                    >
                      <NSelect
                        v-model:value="testFormData.type"
                        :options="messageTypeOptions"
                      />
                    </NFormItem>

                    <NFormItem
                      label="用户名"
                      path="uname"
                    >
                      <NInput
                        v-model:value="testFormData.uname"
                        placeholder="输入测试用户名"
                      />
                    </NFormItem>

                    <NFormItem
                      label="用户ID"
                      path="uid"
                    >
                      <NInputNumber
                        v-model:value="testFormData.uid"
                        placeholder="输入测试用户ID"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Message || testFormData.type === EventDataTypes.SC"
                      label="消息内容"
                      path="msg"
                    >
                      <NInput
                        v-model:value="testFormData.msg"
                        type="textarea"
                        placeholder="输入测试消息内容"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Gift"
                      label="礼物名称"
                      path="msg"
                    >
                      <NInput
                        v-model:value="testFormData.msg"
                        placeholder="输入礼物名称"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Gift"
                      label="礼物数量"
                      path="num"
                    >
                      <NInputNumber
                        v-model:value="testFormData.num"
                        :min="1"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Gift || testFormData.type === EventDataTypes.SC"
                      label="价格/价值"
                      path="price"
                    >
                      <NInputNumber
                        v-model:value="testFormData.price"
                        :min="0"
                      >
                        <template #suffix>
                          {{ testFormData.type === EventDataTypes.SC ? '元' : '元 (礼物价值)' }}
                        </template>
                      </NInputNumber>
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Guard || testFormData.type === EventDataTypes.Message"
                      label="舰长等级"
                      path="guard_level"
                    >
                      <NSelect
                        v-model:value="testFormData.guard_level"
                        :options="guardLevelOptions"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Message"
                      label="粉丝牌等级"
                      path="fans_medal_level"
                    >
                      <NInputNumber
                        v-model:value="testFormData.fans_medal_level"
                        :min="0"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.Message"
                      label="粉丝牌名称"
                      path="fans_medal_name"
                    >
                      <NInput
                        v-model:value="testFormData.fans_medal_name"
                        placeholder="输入粉丝牌名称"
                      />
                    </NFormItem>

                    <NFormItem
                      v-if="testFormData.type === EventDataTypes.SCDel"
                      label="要删除的SC ID"
                      path="sc_id_to_delete"
                    >
                      <NInput
                        v-model:value="testFormData.sc_id_to_delete"
                        placeholder="输入要删除的 SC 消息 ID"
                      />
                    </NFormItem>

                    <NFlex justify="end">
                      <NSpace>
                        <NButton
                          type="info"
                          @click="generateRandomContent"
                        >
                          随机生成内容
                        </NButton>
                        <NButton
                          type="primary"
                          @click="sendTestMessage"
                        >
                          发送测试消息
                        </NButton>
                      </NSpace>
                    </NFlex>
                  </NForm>
                </NCard>
              </NTabPane>
            </NTabs>
          </NFlex>
        </div>
      </template>

      <template #2>
        <div style="height: 100%; width: 100%; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          <!-- 弹幕自动生成控制区 -->
          <div style="margin-bottom: 12px; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 12px;">
            <NFlex
              justify="space-between"
              align="center"
            >
              <NSpace align="center">
                <span style="color: #fff; font-size: 14px;">自动生成弹幕:</span>
                <NSwitch v-model:value="isAutoGenerating" />
              </NSpace>

              <NSpace
                v-if="isAutoGenerating"
                align="center"
              >
                <span style="color: #fff; font-size: 14px;">间隔时间:</span>
                <NInputNumber
                  v-model:value="autoGenerateInterval"
                  :min="0.5"
                  :max="10"
                  :step="0.5"
                  size="small"
                  style="width: 90px;"
                >
                  <template #suffix>
                    秒
                  </template>
                </NInputNumber>
              </NSpace>
            </NFlex>
          </div>

          <!-- 弹幕预览区 -->
          <div
            class="danmuji-obs-preview"
            style="flex: 1; width: 100%; position: relative; border: 1px solid #adadad; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);"
          >
            <DanmujiOBS
              ref="danmujiObsRef"
              :is-o-b-s="false"
              style="height: 100%; width: 100%;"
              :custom-css="css"
              :config="danmujiConfig"
            />
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
  min-height: 0; /* 重要：防止flex子项超出容器 */
}

.left-panel-scroll-container {
  height: 100%;
  overflow-y: auto;
  padding: 0;
}

.danmuji-obs-preview {
  --danmuji-bg: #333;
  background-color: #222;
  background-image: linear-gradient(45deg, var(--danmuji-bg) 25%, transparent 25%),
    linear-gradient(-45deg, var(--danmuji-bg) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--danmuji-bg) 75%),
    linear-gradient(-45deg, transparent 75%, var(--danmuji-bg) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

/* 优化滚动条样式 */
:deep(::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb) {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background: rgba(0, 0, 0, 0.3);
}
</style>
