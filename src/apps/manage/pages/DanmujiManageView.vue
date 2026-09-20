<script setup lang="ts">
import { useElementSize, useIntervalFn } from '@vueuse/core'
import { Copy24Regular, ArrowReset24Regular } from '@vicons/fluent'
import {
  NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NFlex, NFormItem, NIcon,
  NInput, NInputNumber, NPopconfirm, NSelect, NSwitch, NTabPane, NTabs, useMessage,
} from 'naive-ui'
import { computed, onActivated, onDeactivated, onMounted, ref, shallowRef } from 'vue'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, type EventModel } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import MonacoEditorComponent from '@/apps/manage/components/MonacoEditorComponent.vue'
import DanmujiRulesEditor from '@/apps/manage/components/danmuji/DanmujiRulesEditor.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { defaultDanmujiCss } from '@/shared/config/defaultDanmujiCss'
import { normalizeDanmujiConfig } from '@/shared/danmujiConfig'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'

const message = useMessage()
const accountInfo = useAccount()
const css = usePersistedStorage('danmuji-css', defaultDanmujiCss)
if (!css.value) css.value = defaultDanmujiCss
const config = usePersistedStorage('Danmuji.Config', normalizeDanmujiConfig())
config.value = normalizeDanmujiConfig(config.value)
const serverSnapshot = ref<string | null>(null)
const isSaving = ref(false)
const isLoading = ref(false)
const isDirty = computed(() => JSON.stringify(config.value) !== serverSnapshot.value)
const activeTab = ref('style')
const preview = shallowRef<InstanceType<typeof DanmujiOBS>>()
const previewReady = ref(false)
const previewVisible = ref(true)
const previewBg = ref('checker')
const sourceWidth = ref(400)
const sourceHeight = ref(800)
const viewport = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewport)
const fullCanvas = ref(false)
const scale = computed(() => fullCanvas.value
  ? Math.min(1, viewportWidth.value / sourceWidth.value, viewportHeight.value / sourceHeight.value)
  : 1)
const stageStyle = computed(() => fullCanvas.value ? {
  width: `${sourceWidth.value}px`, height: `${sourceHeight.value}px`,
  transform: `scale(${scale.value})`,
} : { width: '100%', height: '100%', transform: 'none' })
const obsUrl = computed(() => buildObsSourceUrl({
  path: 'obs/danmuji', host: CURRENT_HOST, credential: 'token',
  token: accountInfo.value?.id ? accountInfo.value.token : undefined,
}))
const backgroundOptions = [
  { label: '透明网格', value: 'checker' }, { label: '深色', value: 'dark' },
  { label: '浅色', value: 'light' }, { label: '游戏背景', value: 'game' },
]
const eventOptions = [
  { label: '弹幕', value: EventDataTypes.Message }, { label: '礼物', value: EventDataTypes.Gift },
  { label: '醒目留言', value: EventDataTypes.SC }, { label: '大航海', value: EventDataTypes.Guard },
]
const testName = ref('测试观众')
const testMessage = ref('晚上好！这是一条测试弹幕。')
const testGift = ref('小心心')
const testPrice = ref(30)
const testCount = ref(1)
const testGuard = ref(3)
const randomize = ref(false)
const interval = ref(1.5)
const autoEnabled = ref(false)
const samples = ['晚上好，今天也来报到啦！', '这一段太精彩了！', '这是一条较长的测试弹幕，用来查看换行、行间距和气泡宽度是否合适。']

async function sendTest(type = EventDataTypes.Message) {
  const event: Partial<EventModel> & { type: EventDataTypes } = {
    type, uid: Math.floor(Math.random() * 90000) + 10000, open_id: 'preview',
    uname: randomize.value ? `测试观众${Math.floor(Math.random() * 100)}` : testName.value,
    uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    msg: type === EventDataTypes.Gift ? testGift.value : randomize.value ? samples[Math.floor(Math.random() * samples.length)] : testMessage.value,
    price: type === EventDataTypes.Gift ? testPrice.value * 1000 : testPrice.value,
    num: testCount.value, guard_level: type === EventDataTypes.Guard ? testGuard.value : 0,
    fans_medal_level: 21, fans_medal_name: '测试牌', time: Date.now() / 1000,
  }
  await preview.value!.pushTestEvent(event)
}

const { pause, resume } = useIntervalFn(() => {
  const types = [EventDataTypes.Message, EventDataTypes.Message, EventDataTypes.Gift, EventDataTypes.SC]
  void sendTest(types[Math.floor(Math.random() * types.length)])
}, computed(() => interval.value * 1000), { immediate: false })

function toggleAuto(enabled: boolean) {
  autoEnabled.value = enabled
  if (enabled) resume()
  else pause()
}

async function onPreviewReady() {
  previewReady.value = true
  await sendTest()
  await sendTest(EventDataTypes.Gift)
  await sendTest(EventDataTypes.SC)
  await sendTest(EventDataTypes.Guard)
  if (autoEnabled.value) resume()
}

function resetCss() {
  css.value = defaultDanmujiCss
}

async function copy(value: string, label: string) {
  await copyToClipboard(value)
  message.success(`${label}已复制`)
}

async function loadConfig() {
  isLoading.value = true
  try {
    const result = await DownloadConfig<unknown>('danmuji-config')
    if (result.status === 'success' && result.data) {
      config.value = normalizeDanmujiConfig(result.data)
      serverSnapshot.value = JSON.stringify(config.value)
    } else if (result.status !== 'notfound') {
      message.error(result.msg || '读取云端规则失败')
    }
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  isSaving.value = true
  const snapshot = JSON.stringify(config.value)
  try {
    if (await UploadConfig('danmuji-config', JSON.parse(snapshot))) {
      serverSnapshot.value = snapshot
      message.success('功能规则已保存至云端')
    } else message.error('保存失败')
  } catch (error) {
    message.error(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => { if (accountInfo.value?.id) void loadConfig() })
onDeactivated(() => {
  pause()
  previewReady.value = false
  previewVisible.value = false
})
onActivated(() => { previewVisible.value = true })
</script>

<template>
  <div class="danmuji-manage-view">
    <ManagePageHeader title="弹幕姬" subtitle="边调样式，边看效果。预览与 OBS 使用同一套渲染。">
      <template #action>
        <NButton size="small" :disabled="!obsUrl" @click="copy(obsUrl, 'OBS 链接')">
          <template #icon><NIcon :component="Copy24Regular" /></template>复制 OBS 链接
        </NButton>
        <NButton v-if="accountInfo?.id" size="small" type="primary" :loading="isSaving" :disabled="isLoading || !isDirty" @click="saveConfig">
          {{ isDirty ? '保存功能规则' : '规则已同步' }}
        </NButton>
      </template>
    </ManagePageHeader>

    <div class="workspace">
      <section class="editor-panel" aria-label="弹幕姬设置">
        <NTabs v-model:value="activeTab" type="line" size="small">
          <NTabPane name="style" tab="样式定制" display-directive="show">
            <div class="section-heading css-heading">
              <h2>自定义 CSS</h2>
              <NFlex :size="6">
                <NPopconfirm @positive-click="resetCss">
                  <template #trigger><NButton size="tiny" quaternary aria-label="重置样式"><template #icon><NIcon :component="ArrowReset24Regular" /></template>重置</NButton></template>
                  确定恢复默认样式吗？自定义 CSS 将被覆盖。
                </NPopconfirm>
                <NButton size="tiny" secondary @click="copy(css, 'CSS')"><template #icon><NIcon :component="Copy24Regular" /></template>复制 CSS</NButton>
              </NFlex>
            </div>
            <div class="code-editor">
              <MonacoEditorComponent v-model:value="css" language="css" :height="380" :options="{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', scrollBeyondLastLine: false, tabSize: 2 }" />
            </div>
            <p class="hint">修改会自动保存在当前浏览器，并实时应用到右侧预览。</p>
          </NTabPane>
          <NTabPane name="rules" tab="功能规则" display-directive="show">
            <NAlert v-if="isLoading" :show-icon="false" type="info" class="loading-note">正在读取云端规则…</NAlert>
            <DanmujiRulesEditor v-model="config" @reset="config = normalizeDanmujiConfig()" />
          </NTabPane>
        </NTabs>
        <NCollapse class="obs-help">
          <NCollapseItem title="添加到 OBS" name="obs">
            <ol>
              <li>复制 OBS 链接，添加到 OBS 的「浏览器」来源。</li>
              <li>将 OBS 来源宽高设为 {{ sourceWidth }} × {{ sourceHeight }}；勾选「完整画布」可核对实际比例与换行。</li>
              <li>复制 CSS，粘贴到该来源的「自定义 CSS」。之后修改样式也需重新粘贴。</li>
            </ol>
            <p class="hint">功能规则通过上方按钮保存至云端，OBS 会自动读取。</p>
          </NCollapseItem>
        </NCollapse>
      </section>

      <section class="preview-panel" aria-label="实时预览">
        <div class="preview-toolbar">
          <h2>实时预览 <span class="preview-label">示例消息</span></h2>
          <NSelect v-model:value="previewBg" :options="backgroundOptions" size="small" class="background-select" aria-label="预览背景" />
        </div>
        <div class="size-toolbar">
          <label>宽 <NInputNumber v-model:value="sourceWidth" :min="200" :max="3840" :show-button="false" :update-value-on-input="false" size="small" aria-label="来源宽度" /></label>
          <span>×</span>
          <label>高 <NInputNumber v-model:value="sourceHeight" :min="200" :max="2160" :show-button="false" :update-value-on-input="false" size="small" aria-label="来源高度" /></label>
          <NCheckbox v-model:checked="fullCanvas" size="small">完整画布</NCheckbox>
          <span class="hint">{{ fullCanvas ? `${Math.round(scale * 100)}% · 等比缩放` : '铺满预览 · 原始字号' }}</span>
        </div>
        <div class="stage" :class="`bg-${previewBg}`">
          <div ref="viewport" class="viewport">
            <div class="scaled-bounds" :style="fullCanvas ? { width: `${sourceWidth * scale}px`, height: `${sourceHeight * scale}px` } : { width: '100%', height: '100%' }">
              <div class="source-canvas" :style="stageStyle">
                <DanmujiOBS v-if="previewVisible" ref="preview" preview :custom-css="css" :config="config" @ready="onPreviewReady" />
              </div>
            </div>
          </div>
        </div>
        <div class="test-toolbar">
          <NFlex align="center" :size="6">
            <span class="hint">发送测试</span>
            <NButton v-for="event in eventOptions" :key="event.value" size="tiny" secondary :disabled="!previewReady" @click="sendTest(event.value)">{{ event.label }}</NButton>
          </NFlex>
          <NButton size="tiny" quaternary :disabled="!previewReady" @click="preview!.clearMessages()">清空</NButton>
        </div>
        <div class="auto-toolbar">
          <NFlex align="center" :size="8">
            <NSwitch :value="autoEnabled" :disabled="!previewReady" size="small" aria-label="自动发送示例" @update:value="toggleAuto" />
            <span>自动发送</span>
            <NInputNumber v-model:value="interval" :min="0.3" :max="5" :step="0.2" :update-value-on-input="false" size="small" class="interval-input"><template #suffix>秒</template></NInputNumber>
          </NFlex>
          <NCheckbox v-model:checked="randomize" size="small">随机内容</NCheckbox>
        </div>
        <NCollapse class="test-details">
          <NCollapseItem title="编辑测试消息" name="message">
            <div class="test-fields">
              <NFormItem label="用户名" :show-feedback="false"><NInput v-model:value="testName" size="small" /></NFormItem>
              <NFormItem label="礼物名称" :show-feedback="false"><NInput v-model:value="testGift" size="small" /></NFormItem>
              <NFormItem label="金额（元）" :show-feedback="false"><NInputNumber v-model:value="testPrice" :min="0" :update-value-on-input="false" size="small" /></NFormItem>
              <NFormItem label="礼物数量" :show-feedback="false"><NInputNumber v-model:value="testCount" :min="1" :precision="0" :update-value-on-input="false" size="small" /></NFormItem>
              <NFormItem label="大航海等级" :show-feedback="false"><NSelect v-model:value="testGuard" :options="[{ label: '舰长', value: 3 }, { label: '提督', value: 2 }, { label: '总督', value: 1 }]" size="small" /></NFormItem>
              <NFormItem label="弹幕 / 醒目留言内容" :show-feedback="false" class="message-field"><NInput v-model:value="testMessage" type="textarea" :rows="2" size="small" /></NFormItem>
            </div>
          </NCollapseItem>
        </NCollapse>
      </section>
    </div>
  </div>
</template>

<style scoped>
.danmuji-manage-view { width: 100%; }
.workspace { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(360px, 1fr); gap: 20px; margin-top: 16px; align-items: start; }
.editor-panel, .preview-panel { color: var(--vtsuru-fg); min-width: 0; border: 1px solid var(--vtsuru-border); border-radius: 8px; background: var(--vtsuru-bg-elevated); padding: 16px; }
.preview-panel { position: sticky; top: 16px; }
h2 { margin: 0; font-size: 13px; font-weight: 600; }
.section-heading, .preview-toolbar, .test-toolbar, .auto-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section-heading { margin: 4px 0 10px; }
.section-heading > span, .hint, .preview-label { color: var(--vtsuru-fg-muted); font-size: 12px; font-weight: 400; }
.preview-label { margin-left: 6px; }

.css-heading { margin-top: 20px; }
.code-editor { overflow: hidden; border: 1px solid var(--vtsuru-border); border-radius: 6px; }
p.hint { margin: 10px 0 0; line-height: 1.6; }
.obs-help { border-top: 1px solid var(--vtsuru-border); margin-top: 16px; padding-top: 14px; }
ol { margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.8; }
.background-select { width: 116px; }
.size-toolbar { display: flex; align-items: center; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
.size-toolbar label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vtsuru-fg-muted); }
.size-toolbar :deep(.n-input-number) { width: 70px; }
.stage { height: clamp(280px, 49dvh, 520px); padding: 12px; border: 1px solid var(--vtsuru-border); border-radius: 6px; overflow: hidden; }
.viewport { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.scaled-bounds { position: relative; flex-shrink: 0; outline: 1px dashed #94a3b866; }
.source-canvas { position: absolute; inset: 0 auto auto 0; transform-origin: top left; overflow: hidden; }
.bg-checker { background-color: #202328; background-image: conic-gradient(#2c3036 25%, transparent 0 50%, #2c3036 0 75%, transparent 0); background-size: 20px 20px; }
.bg-dark { background: #111318; }
.bg-light { background: #eef0f4; }
.bg-game { background: radial-gradient(ellipse at 80% 20%, #416480, transparent 60%), radial-gradient(ellipse at 20% 80%, #694659, transparent 60%), #171e2c; }
.test-toolbar { margin-top: 12px; flex-wrap: wrap; }
.auto-toolbar { margin-top: 12px; flex-wrap: wrap; font-size: 12px; }
.interval-input { width: 100px; }
.test-details { margin-top: 16px; border-top: 1px solid var(--vtsuru-border); padding-top: 12px; }
.test-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.message-field { grid-column: 1 / -1; }
.loading-note { margin-bottom: 12px; }
@media (max-width: 1000px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .preview-panel { position: static; grid-row: 1; }
  .stage { height: 320px; }
}
@media (max-width: 480px) {
  .editor-panel, .preview-panel { padding: 12px; }
  .workspace { gap: 12px; }
}
</style>
