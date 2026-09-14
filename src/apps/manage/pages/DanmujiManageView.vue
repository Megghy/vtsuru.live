<script setup lang="ts">
import {
  ArrowReset24Regular,
  CloudCheckmark24Regular,
  Code24Regular,
  Color24Regular,
  Copy24Regular,
  Desktop24Regular,
  Eye24Regular,
  Flash24Regular,
  Gift24Regular,
  Money24Regular,
  Play24Filled,
  Save24Regular,
  Send24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
  Target24Regular,
  VehicleShip24Regular,
  Wrench24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import MonacoEditorComponent from '@/apps/manage/components/MonacoEditorComponent.vue'
import { DANMUJI_PRESETS, defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'

interface DanmujiConfig {
  showDanmaku: boolean
  showGift: boolean
  showGiftName: boolean
  mergeSimilarDanmaku: boolean
  mergeGift: boolean
  minGiftPrice: number
  maxNumber: number
  blockUsers: string[]
  blockKeywords: string[]
  giftUsernamePronunciation: string
}

const defaultConfig: DanmujiConfig = {
  showDanmaku: true,
  showGift: true,
  showGiftName: true,
  mergeSimilarDanmaku: false,
  mergeGift: true,
  minGiftPrice: 0.1,
  maxNumber: 60,
  blockUsers: [],
  blockKeywords: [],
  giftUsernamePronunciation: '',
}

const message = useMessage()
const accountInfo = useAccount()

// 激活视图 Tab
const activeMainTab = ref<'settings' | 'preview'>('settings')

// CSS 与配置持久化
const css = usePersistedStorage<string>('Danmuji.Css', defaultDanmujiCss)
const danmujiConfig = usePersistedStorage<DanmujiConfig>('Danmuji.Config', defaultConfig)

const serverConfigSnapshot = ref<string>('')
const isSavingCloud = ref(false)
const isLoading = ref(false)

const hasUnsavedConfig = computed(() => {
  if (!serverConfigSnapshot.value) return false
  return JSON.stringify(danmujiConfig.value) !== serverConfigSnapshot.value
})

// OBS 链接
const obsUrl = computed(() => {
  return buildObsSourceUrl({
    path: 'obs/danmuji',
    host: CURRENT_HOST,
    credential: 'token',
    token: accountInfo.value?.id ? accountInfo.value.token : undefined,
  })
})

// 选中的预设 ID
const selectedPresetId = ref<string>('glass')

function applyPreset(presetId: 'glass' | 'minimal' | 'anime' | 'transparent') {
  const target = DANMUJI_PRESETS.find((p) => p.id === presetId)
  if (!target) return
  selectedPresetId.value = presetId
  css.value = target.css
  message.success(`已应用「${target.name}」预设`)
}

function resetCssToDefault() {
  css.value = defaultDanmujiCss
  selectedPresetId.value = 'glass'
  message.success('已重设为默认 CSS 样式')
}

function resetConfigToDefault() {
  danmujiConfig.value = { ...defaultConfig }
  message.success('已恢复默认功能配置')
}

// ================= 仿真与测试系统 =================
const danmujiObsRef = shallowRef<any>(null)
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')
const isAutoGenerating = ref(false)
const autoGenerateInterval = ref(1.5)
let autoGenerateTimer: ReturnType<typeof setTimeout> | null = null

// 屏蔽词辅助编辑
const blockUsersText = computed({
  get: () => danmujiConfig.value.blockUsers?.join('\n') || '',
  set: (val: string) => {
    danmujiConfig.value.blockUsers = val.split('\n').map((s) => s.trim()).filter(Boolean)
  },
})

const blockKeywordsText = computed({
  get: () => danmujiConfig.value.blockKeywords?.join('\n') || '',
  set: (val: string) => {
    danmujiConfig.value.blockKeywords = val.split('\n').map((s) => s.trim()).filter(Boolean)
  },
})

// 测试数据表单
const testFormData = reactive({
  type: EventDataTypes.Message,
  uname: '桃饱网高级会员',
  face: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
  price: 50,
  message: '主播好棒！太帅了！',
  gift_name: '小心心',
  num: 1,
  guard_level: 3,
  fans_medal_level: 21,
  fans_medal_name: '小蛋糕',
})

const sampleMessages = [
  '主播今晚玩什么游戏呀？',
  '2333333333 太草了',
  '单抽出奇迹！吸吸欧气！',
  '前面的别跑，加我一个！',
  '666666 这波操作拉满了',
  '晚上好！今天也准时来报到啦～',
  '这波配合简直天衣无缝！',
]

const sampleUsers = ['七海的大号', '猫猫不吃鱼', '冰镇可乐加冰', '星空漫步者', '巡音流歌', '夜雨声烦']
const sampleGifts = [
  { name: '小心心', price: 0.1 },
  { name: '辣条', price: 0.2 },
  { name: '吃瓜', price: 1 },
  { name: '牛哇牛哇', price: 5 },
  { name: '能量饮料', price: 9.9 },
  { name: 'B坷垃', price: 28 },
  { name: '摩天大楼', price: 450 },
]

function generateRandomTest() {
  testFormData.uname = sampleUsers[Math.floor(Math.random() * sampleUsers.length)]
  testFormData.message = sampleMessages[Math.floor(Math.random() * sampleMessages.length)]
  const g = sampleGifts[Math.floor(Math.random() * sampleGifts.length)]
  testFormData.gift_name = g.name
  testFormData.price = g.price
  testFormData.num = Math.floor(Math.random() * 10) + 1
}

function sendSingleTest(type?: EventDataTypes) {
  if (type) testFormData.type = type
  if (!danmujiObsRef.value) {
    message.warning('请先切换到「OBS 预览与调试」Tab 查看渲染')
    activeMainTab.value = 'preview'
    return
  }

  const rawData: any = {
    uname: testFormData.uname,
    face: testFormData.face,
    uid: 10000 + Math.floor(Math.random() * 90000),
    guard_level: testFormData.guard_level,
    fans_medal_level: testFormData.fans_medal_level,
    fans_medal_name: testFormData.fans_medal_name,
  }

  if (testFormData.type === EventDataTypes.Message) {
    rawData.msg = testFormData.message
  } else if (testFormData.type === EventDataTypes.Gift) {
    rawData.gift_name = testFormData.gift_name
    rawData.price = testFormData.price
    rawData.num = testFormData.num
    rawData.total_price = testFormData.price * testFormData.num
  } else if (testFormData.type === EventDataTypes.SC) {
    rawData.message = testFormData.message
    rawData.price = testFormData.price
  } else if (testFormData.type === EventDataTypes.Guard) {
    rawData.role_name = testFormData.guard_level === 1 ? '总督' : testFormData.guard_level === 2 ? '提督' : '舰长'
    rawData.num = 1
    rawData.price = testFormData.guard_level === 1 ? 19998 : testFormData.guard_level === 2 ? 1998 : 198
  }

  danmujiObsRef.value.pushTestEvent({
    type: testFormData.type,
    data: rawData,
    date: Date.now(),
  })
}

function startAutoStream() {
  if (!danmujiObsRef.value || !isAutoGenerating.value) return
  generateRandomTest()
  const types = [EventDataTypes.Message, EventDataTypes.Message, EventDataTypes.Message, EventDataTypes.Gift, EventDataTypes.SC]
  testFormData.type = types[Math.floor(Math.random() * types.length)]
  sendSingleTest()
  autoGenerateTimer = setTimeout(startAutoStream, autoGenerateInterval.value * 1000)
}

watch(isAutoGenerating, (val) => {
  if (val) {
    if (activeMainTab.value !== 'preview') activeMainTab.value = 'preview'
    nextTick(() => startAutoStream())
  } else if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
    autoGenerateTimer = null
  }
})

// 云端同步
async function syncFromCloud() {
  isLoading.value = true
  try {
    const res = await DownloadConfig<DanmujiConfig>('danmuji-config')
    if (res.status === 'success' && res.data) {
      danmujiConfig.value = res.data
      serverConfigSnapshot.value = JSON.stringify(res.data)
      message.success('已同步云端弹幕机配置')
    } else {
      message.info('云端暂无保存的配置')
    }
  } finally {
    isLoading.value = false
  }
}

async function saveToCloud() {
  isSavingCloud.value = true
  try {
    const success = await UploadConfig('danmuji-config', danmujiConfig.value)
    if (success) {
      serverConfigSnapshot.value = JSON.stringify(danmujiConfig.value)
      message.success('弹幕机配置已保存并同步至云端')
    } else {
      message.error('上传失败')
    }
  } catch (err: any) {
    message.error(`保存失败: ${err?.message || err}`)
  } finally {
    isSavingCloud.value = false
  }
}

async function copyObsLink() {
  await copyToClipboard(obsUrl.value)
  message.success('OBS 浏览器源地址已复制到剪贴板')
}

async function copyFullCss() {
  await copyToClipboard(css.value)
  message.success('自定义 CSS 已复制到剪贴板')
}

onMounted(async () => {
  if (accountInfo.value?.id) {
    await syncFromCloud()
  }
})

onUnmounted(() => {
  if (autoGenerateTimer) {
    clearTimeout(autoGenerateTimer)
    autoGenerateTimer = null
  }
})
</script>

<template>
  <div class="danmuji-manage-view">
    <!-- 统一标准管理头 -->
    <ManagePageHeader
      title="弹幕姬管理与样式定制"
      subtitle="在 OBS 中渲染高颜值弹幕流，支持开箱即用现代预设、Monaco CSS 自定义、弹幕过滤合并与 1080P 实时仿真"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x800 或按需调整',
        },
      ]"
    >
      <template #action>
        <NButton
          v-if="accountInfo?.id"
          size="small"
          secondary
          :loading="isSavingCloud"
          @click="saveToCloud"
        >
          <template #icon>
            <NIcon :component="hasUnsavedConfig ? Save24Regular : CloudCheckmark24Regular" />
          </template>
          {{ hasUnsavedConfig ? '保存至云端 (未同步)' : '已同步云端' }}
        </NButton>
      </template>
    </ManagePageHeader>

    <!-- 主工作区 Tabs -->
    <NTabs
      v-model:value="activeMainTab"
      type="segment"
      animated
      class="main-nav-tabs"
      style="margin-top: 14px"
    >
      <!-- ================= Tab 1: 样式定制与规则配置 ================= -->
      <NTabPane name="settings">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Wrench24Regular" />
            <span>样式定制与功能规则</span>
          </NFlex>
        </template>
        <NFlex vertical :size="16" style="margin-top: 14px">
          <!-- 预设选择卡片 -->
          <NCard size="small">
            <template #header>
              <NFlex align="center" :size="6">
                <NIcon :component="Color24Regular" />
                <span>开箱即用现代预设</span>
              </NFlex>
            </template>
            <template #header-extra>
              <NFlex align="center" :size="8">
                <NButton size="tiny" secondary @click="copyFullCss">
                  <template #icon><NIcon :component="Copy24Regular" /></template>
                  复制完整 CSS
                </NButton>
                <NPopconfirm @positive-click="resetCssToDefault">
                  <template #trigger>
                    <NButton size="tiny" secondary type="warning">
                      <template #icon><NIcon :component="ArrowReset24Regular" /></template>
                      重置为默认
                    </NButton>
                  </template>
                  确定要重设为默认样式吗？自定义代码将被覆盖。
                </NPopconfirm>
              </NFlex>
            </template>

            <NGrid :x-gap="12" :y-gap="12" :cols="4" responsive="screen">
              <NGi v-for="preset in DANMUJI_PRESETS" :key="preset.id">
                <div
                  class="preset-card"
                  :class="{ active: selectedPresetId === preset.id }"
                  @click="applyPreset(preset.id)"
                >
                  <div class="preset-header">
                    <span class="preset-name">{{ preset.name }}</span>
                    <NTag v-if="selectedPresetId === preset.id" size="tiny" type="primary" :bordered="false">已载入</NTag>
                  </div>
                  <div class="preset-desc">{{ preset.description }}</div>
                </div>
              </NGi>
            </NGrid>
          </NCard>

          <!-- Monaco CSS 编辑器与功能规则分栏 -->
          <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen">
            <!-- 左侧：Monaco CSS 高级编辑器 (占 7 列) -->
            <NGi :span="7">
              <NCard size="small" style="height: 100%">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Code24Regular" />
                    <span>自定义 CSS 深度调优</span>
                  </NFlex>
                </template>
                <template #header-extra>
                  <NText depth="3" style="font-size: 11px">支持标准 CSS / Keyframes / @import</NText>
                </template>

                <div class="monaco-editor-wrapper">
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
                      wordWrap: 'on',
                    }"
                  />
                </div>
              </NCard>
            </NGi>

            <!-- 右侧：过滤与合并规则配置 (占 5 列) -->
            <NGi :span="5">
              <NCard size="small" style="height: 100%">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Settings24Regular" />
                    <span>过滤、合并与阈值规则</span>
                  </NFlex>
                </template>
                <template #header-extra>
                  <NPopconfirm @positive-click="resetConfigToDefault">
                    <template #trigger>
                      <NButton size="tiny" quaternary type="error">恢复默认规则</NButton>
                    </template>
                    确定要重设为默认功能配置吗？
                  </NPopconfirm>
                </template>

                <NForm :model="danmujiConfig" label-placement="top" size="small">
                  <!-- 显示类型 -->
                  <div class="form-section-title">消息显示开关</div>
                  <NGrid :x-gap="8" :y-gap="8" :cols="3">
                    <NGi>
                      <NCard size="small" embedded class="checkbox-pill">
                        <NCheckbox v-model:checked="danmujiConfig.showDanmaku">普通弹幕</NCheckbox>
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" embedded class="checkbox-pill">
                        <NCheckbox v-model:checked="danmujiConfig.showGift">礼物消息</NCheckbox>
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" embedded class="checkbox-pill">
                        <NCheckbox v-model:checked="danmujiConfig.showGiftName">显示礼物名</NCheckbox>
                      </NCard>
                    </NGi>
                  </NGrid>

                  <!-- 合并策略 -->
                  <div class="form-section-title" style="margin-top: 12px">合并与节流</div>
                  <NGrid :x-gap="8" :y-gap="8" :cols="2">
                    <NGi>
                      <NCard size="small" embedded class="checkbox-pill">
                        <NCheckbox v-model:checked="danmujiConfig.mergeSimilarDanmaku">合并相似弹幕</NCheckbox>
                      </NCard>
                    </NGi>
                    <NGi>
                      <NCard size="small" embedded class="checkbox-pill">
                        <NCheckbox v-model:checked="danmujiConfig.mergeGift">合并连击礼物</NCheckbox>
                      </NCard>
                    </NGi>
                  </NGrid>

                  <!-- 阈值 -->
                  <div class="form-section-title" style="margin-top: 12px">阈值与限制</div>
                  <NGrid :x-gap="8" :y-gap="8" :cols="2">
                    <NGi>
                      <NFormItem label="最大消息积压数">
                        <NInputNumber v-model:value="danmujiConfig.maxNumber" :min="10" :max="300" style="width: 100%" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="最低展示礼物价值">
                        <NInputNumber v-model:value="danmujiConfig.minGiftPrice" :min="0" :step="0.1" style="width: 100%">
                          <template #suffix>元</template>
                        </NInputNumber>
                      </NFormItem>
                    </NGi>
                  </NGrid>

                  <!-- 屏蔽名单 -->
                  <div class="form-section-title" style="margin-top: 4px">屏蔽与过滤</div>
                  <NGrid :x-gap="8" :y-gap="8" :cols="2">
                    <NGi>
                      <NFormItem label="屏蔽用户名 (一行一个)">
                        <NInput v-model:value="blockUsersText" type="textarea" :rows="3" placeholder="用户A&#10;用户B" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="屏蔽关键词 (一行一个)">
                        <NInput v-model:value="blockKeywordsText" type="textarea" :rows="3" placeholder="词条A&#10;词条B" />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                </NForm>
              </NCard>
            </NGi>
          </NGrid>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 2: OBS 画布实时预览与仿真调试 ================= -->
      <NTabPane name="preview">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Desktop24Regular" />
            <span>OBS 舞台预览与仿真</span>
          </NFlex>
        </template>
        <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen" style="margin-top: 14px">
          <!-- 左侧：1080P 舞台视口 (占 8 列) -->
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

              <!-- 舞台视口容器 -->
              <div class="stage-viewport" :class="[`bg-${previewBg}`]">
                <div class="stage-canvas">
                  <DanmujiOBS
                    ref="danmujiObsRef"
                    :custom-css="css"
                    :danmuji-config="danmujiConfig"
                  />
                </div>
              </div>

              <template #action>
                <NFlex justify="space-between" align="center">
                  <NText depth="3" style="font-size: 12px">
                    OBS 来源配置指引：在 OBS 添加「浏览器」来源并填入 URL，将「自定义 CSS」框清空（或填入上方代码）即可。
                  </NText>
                  <NButton size="small" type="primary" @click="copyObsLink">
                    <template #icon><NIcon :component="Copy24Regular" /></template>
                    复制 OBS 链接
                  </NButton>
                </NFlex>
              </template>
            </NCard>
          </NGi>

          <!-- 右侧：仿真调试控制器 (占 4 列) -->
          <NGi :span="4">
            <NFlex vertical :size="16">
              <!-- 自动推流器 -->
              <NCard size="small">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Flash24Regular" />
                    <span>自动弹幕推流仿真</span>
                  </NFlex>
                </template>
                <template #header-extra>
                  <NSwitch v-model:value="isAutoGenerating" size="small">
                    <template #checked>推流中</template>
                    <template #unchecked>已暂停</template>
                  </NSwitch>
                </template>

                <NFlex vertical :size="10">
                  <NFlex justify="space-between" align="center">
                    <span style="font-size: 12px; color: var(--vtsuru-fg-muted)">推流间隔时间：</span>
                    <NInputNumber
                      v-model:value="autoGenerateInterval"
                      :min="0.3"
                      :max="5"
                      :step="0.2"
                      size="tiny"
                      style="width: 110px"
                    >
                      <template #suffix>秒</template>
                    </NInputNumber>
                  </NFlex>

                  <NText depth="3" style="font-size: 11px">
                    启动后将自动按设定间隔随机注入真实弹幕、醒目留言与高频礼物，测试 OBS 动效流畅度。
                  </NText>
                </NFlex>
              </NCard>

              <!-- 手动单条注入 -->
              <NCard size="small">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Target24Regular" />
                    <span>一键注入特定事件</span>
                  </NFlex>
                </template>
                <NFlex vertical :size="10">
                  <NFlex :size="8">
                    <NButton size="tiny" secondary @click="sendSingleTest(EventDataTypes.Message)">
                      <template #icon><NIcon :component="Send24Regular" /></template>
                      普通弹幕
                    </NButton>
                    <NButton size="tiny" secondary type="info" @click="sendSingleTest(EventDataTypes.Gift)">
                      <template #icon><NIcon :component="Gift24Regular" /></template>
                      豪华礼物
                    </NButton>
                    <NButton size="tiny" secondary type="warning" @click="sendSingleTest(EventDataTypes.SC)">
                      <template #icon><NIcon :component="Money24Regular" /></template>
                      醒目留言
                    </NButton>
                    <NButton size="tiny" secondary type="error" @click="sendSingleTest(EventDataTypes.Guard)">
                      <template #icon><NIcon :component="ShieldCheckmark24Regular" /></template>
                      续费大航海
                    </NButton>
                  </NFlex>

                  <NDivider style="margin: 4px 0" />

                  <NButton size="small" block secondary @click="generateRandomTest">
                    <template #icon><NIcon :component="Sparkle24Regular" /></template>
                    随机重置测试文案
                  </NButton>
                </NFlex>
              </NCard>
            </NFlex>
          </NGi>
        </NGrid>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.danmuji-manage-view {
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

/* 预设卡片 */
.preset-card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-card:hover {
  border-color: var(--vtsuru-brand-soft);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preset-card.active {
  border-color: var(--vtsuru-brand-soft);
  background: var(--vtsuru-brand-tint);
}

.preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preset-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--vtsuru-fg);
}

.preset-desc {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.35;
}

/* 编辑器容器 */
.monaco-editor-wrapper {
  height: 480px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
}

/* 规则表单 */
.form-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--vtsuru-fg-muted);
  margin-bottom: 6px;
}

.checkbox-pill {
  border-radius: 6px;
  padding: 6px 10px;
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
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
