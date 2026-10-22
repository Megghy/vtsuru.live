<script setup lang="ts">
import { ArrowReset24Regular, Copy24Regular } from '@vicons/fluent'
import { useElementSize, useIntervalFn } from '@vueuse/core'
import { computed, onActivated, onDeactivated, ref, shallowRef } from 'vue'

import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, type EventModel } from '@/api/api-models'
import DanmujiRulesEditor from '@/apps/manage/components/danmuji/DanmujiRulesEditor.vue'
import DanmujiStyleEditor from '@/apps/manage/components/danmuji/DanmujiStyleEditor.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import MonacoEditorComponent from '@/apps/manage/components/MonacoEditorComponent.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { CURRENT_HOST } from '@/shared/config'
import { normalizeDanmujiConfig } from '@/shared/danmujiConfig'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'
import { copyToClipboard } from '@/shared/utils'

const message = useMessage()
const accountInfo = useAccount()
const legacyCss = usePersistedStorage('danmuji-css', '')
const config = usePersistedStorage('Danmuji.Config', normalizeDanmujiConfig(), {
  serializer: { read: (value) => normalizeDanmujiConfig(JSON.parse(value)), write: JSON.stringify },
  onReady: () => {
    if (accountInfo.value?.id) void loadConfig()
    else isLoading.value = false
  },
})
const serverSnapshot = ref<string | null>(null)
const isSaving = ref(false)
const isLoading = ref(true)
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
const scale = computed(() =>
  fullCanvas.value
    ? Math.min(1, viewportWidth.value / sourceWidth.value, viewportHeight.value / sourceHeight.value)
    : 1,
)
const stageStyle = computed(() =>
  fullCanvas.value
    ? {
        width: `${sourceWidth.value}px`,
        height: `${sourceHeight.value}px`,
        transform: `scale(${scale.value})`,
      }
    : { width: '100%', height: '100%', transform: 'none' },
)
const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/danmuji',
    host: CURRENT_HOST,
    credential: 'token',
    token: accountInfo.value?.id ? accountInfo.value.token : undefined,
  }),
)

const eventOptions = [
  { label: '弹幕', value: EventDataTypes.Message },
  { label: '礼物', value: EventDataTypes.Gift },
  { label: '醒目留言', value: EventDataTypes.SC },
  { label: '大航海', value: EventDataTypes.Guard },
]
const testName = ref('测试观众')
const testMessage = ref('晚上好！这是一条测试弹幕。')
const testGift = ref('小心心')
const testPrice = ref(30)
const testCount = ref(1)
const testGuard = ref('3')
const randomize = ref(false)
const interval = ref(1.5)
const autoEnabled = ref(false)
const samples = [
  '晚上好，今天也来报到啦！',
  '这一段太精彩了！',
  '这是一条较长的测试弹幕，用来查看换行、行间距和气泡宽度是否合适。',
]

async function sendTest(type = EventDataTypes.Message) {
  const event: Partial<EventModel> & { type: EventDataTypes } = {
    type,
    uid: Math.floor(Math.random() * 90000) + 10000,
    open_id: 'preview',
    uname: randomize.value ? `测试观众${Math.floor(Math.random() * 100)}` : testName.value,
    uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    msg:
      type === EventDataTypes.Gift
        ? testGift.value
        : randomize.value
          ? samples[Math.floor(Math.random() * samples.length)]
          : testMessage.value,
    price: type === EventDataTypes.Gift ? testPrice.value * 1000 : testPrice.value,
    num: testCount.value,
    guard_level: type === EventDataTypes.Guard ? Number(testGuard.value) : 0,
    fans_medal_level: 21,
    fans_medal_name: '测试牌',
    time: Date.now() / 1000,
  }
  await preview.value!.pushTestEvent(event)
}

const { pause, resume } = useIntervalFn(
  () => {
    const types = [EventDataTypes.Message, EventDataTypes.Message, EventDataTypes.Gift, EventDataTypes.SC]
    void sendTest(types[Math.floor(Math.random() * types.length)])
  },
  computed(() => interval.value * 1000),
  { immediate: false },
)

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
  config.value.style.customCss = ''
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
      message.error(result.msg || '读取云端配置失败')
    }
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  const snapshot = JSON.stringify(config.value)
  if (new TextEncoder().encode(snapshot).byteLength > 512 * 1024) {
    message.error('配置超过 512 KiB（UTF-8），请精简自定义 CSS 或表情规则后保存')
    return
  }
  isSaving.value = true
  try {
    if (await UploadConfig('danmuji-config', JSON.parse(snapshot))) {
      serverSnapshot.value = snapshot
      message.success('样式与规则已保存，OBS 将在五秒内同步')
    } else {
      message.error('保存失败')
    }
  } catch (error) {
    message.error(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isSaving.value = false
  }
}

onDeactivated(() => {
  pause()
  previewReady.value = false
  previewVisible.value = false
})
onActivated(() => {
  previewVisible.value = true
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="弹幕姬"
      subtitle="边调样式，边看效果。预览与 OBS 使用同一套渲染。"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            :disabled="!obsUrl"
            @click="copy(obsUrl, 'OBS 链接')"
          >
            <component
              :is="Copy24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            复制 OBS 链接
          </Button>

          <Button
            v-if="accountInfo?.id"
            variant="default"
            :loading="isSaving"
            :disabled="isLoading || !isDirty"
            @click="saveConfig"
          >
            {{ isDirty ? '保存配置' : '已同步' }}
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <!-- 左侧：设置面板 (7 列) -->
      <Card class="lg:col-span-7">
        <CardContent class="p-4 space-y-4">
          <Alert
            v-if="isLoading"
            class="border-border bg-muted/40 py-2"
          >
            <AlertDescription class="text-xs"> 正在读取配置… </AlertDescription>
          </Alert>

          <Tabs
            v-model="activeTab"
            class="w-full"
          >
            <TabsList class="grid w-full grid-cols-2 max-w-xs p-0.5 bg-muted mb-3">
              <TabsTrigger
                value="style"
                class="text-xs h-7"
              >
                样式定制
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                class="text-xs h-7"
              >
                功能规则
              </TabsTrigger>
            </TabsList>

            <!-- 样式定制 Tab -->
            <TabsContent
              value="style"
              class="space-y-4 mt-2"
            >
              <DanmujiStyleEditor v-model="config.style" />

              <Alert
                v-if="legacyCss"
                class="border-border bg-muted/40"
              >
                <div class="flex items-center justify-between text-xs">
                  <span>此浏览器留有旧版 CSS，可导入后保存至云端。</span>
                  <AlertDialog>
                    <AlertDialogTrigger as-child>
                      <Button
                        size="xs"
                        variant="outline"
                      >
                        导入本地 CSS
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent class="sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>导入旧版 CSS？</AlertDialogTitle>
                        <AlertDialogDescription class="text-xs">
                          用旧版 CSS 替换当前自定义覆盖？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction @click="config.style.customCss = legacyCss"> 确认导入 </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Alert>

              <!-- 自定义覆盖 CSS 编辑器 -->
              <div class="space-y-2 pt-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >自定义覆盖 CSS</span
                  >
                  <div class="flex items-center gap-1.5">
                    <AlertDialog>
                      <AlertDialogTrigger as-child>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="text-muted-foreground hover:text-destructive"
                        >
                          <component
                            :is="ArrowReset24Regular"
                            class="h-3.5 w-3.5 mr-1"
                          />
                          重置
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent class="sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>重置自定义 CSS？</AlertDialogTitle>
                          <AlertDialogDescription class="text-xs">
                            确定清空自定义覆盖 CSS，恢复预设与参数的效果吗？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            @click="resetCss"
                          >
                            确认重置
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button
                      size="xs"
                      variant="outline"
                      @click="copy(config.style.customCss, 'CSS')"
                    >
                      <component
                        :is="Copy24Regular"
                        class="h-3.5 w-3.5 mr-1"
                      />
                      复制 CSS
                    </Button>
                  </div>
                </div>

                <div class="rounded-md border border-border overflow-hidden">
                  <MonacoEditorComponent
                    v-model:value="config.style.customCss"
                    language="css"
                    :height="360"
                    :options="{
                      minimap: { enabled: false },
                      fontSize: 13,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                    }"
                  />
                </div>
                <p class="text-[11px] text-muted-foreground leading-relaxed">
                  修改实时应用到预览，点击「保存配置」后同步至 OBS。预设和参数不会改写自定义 CSS；自定义覆盖优先。
                </p>
              </div>
            </TabsContent>

            <!-- 功能规则 Tab -->
            <TabsContent
              value="rules"
              class="mt-2"
            >
              <DanmujiRulesEditor
                v-model="config"
                @reset="config = { ...normalizeDanmujiConfig(), style: config.style }"
              />
            </TabsContent>
          </Tabs>

          <!-- OBS 添加说明折叠提示 -->
          <div class="pt-3 border-t border-border space-y-2">
            <span class="text-xs font-semibold text-foreground">添加到 OBS 步骤指引</span>
            <ol class="list-decimal list-inside text-xs text-muted-foreground space-y-1 leading-relaxed">
              <li>复制上方 OBS 链接，添加到 OBS 的「浏览器」来源。</li>
              <li>将 OBS 来源宽高设为 {{ sourceWidth }} × {{ sourceHeight }}；勾选右侧「完整画布」可核对实际比例。</li>
              <li>点击「保存配置」，样式与规则将自动同步到 OBS。</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <!-- 右侧：实时预览面板 (5 列) -->
      <Card class="lg:col-span-5 lg:sticky lg:top-4">
        <CardContent class="p-4 space-y-3.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-foreground"
              >实时预览 <span class="text-muted-foreground font-normal ml-1">示例消息</span></span
            >
            <div class="flex items-center gap-1 bg-muted p-0.5 rounded-md">
              <Button
                v-for="bg in [
                  { key: 'checker', label: '网格' },
                  { key: 'dark', label: '深色' },
                  { key: 'light', label: '浅色' },
                  { key: 'game', label: '游戏' },
                ]"
                :key="bg.key"
                size="xs"
                :variant="previewBg === bg.key ? 'default' : 'ghost'"
                class="h-6 px-2"
                @click="previewBg = bg.key"
              >
                {{ bg.label }}
              </Button>
            </div>
          </div>

          <!-- 画布尺寸设置条 -->
          <div class="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <div class="flex items-center gap-1">
              <span>宽</span>
              <Input
                size="xs"
                v-model.number="sourceWidth"
                type="number"
                min="200"
                max="3840"
                class="w-16 font-mono"
              />
            </div>
            <span>×</span>
            <div class="flex items-center gap-1">
              <span>高</span>
              <Input
                size="xs"
                v-model.number="sourceHeight"
                type="number"
                min="200"
                max="2160"
                class="w-16 font-mono"
              />
            </div>
            <label class="flex items-center gap-1.5 cursor-pointer ml-auto select-none text-foreground font-medium">
              <Checkbox v-model="fullCanvas" />
              <span>完整画布</span>
            </label>
          </div>

          <!-- 舞台视口 -->
          <div
            class="h-[420px] p-3 rounded-lg border border-border overflow-hidden relative"
            :class="{
              'bg-[#111318]': previewBg === 'dark',
              'bg-[#eef0f4]': previewBg === 'light',
              'bg-[#171e2c]': previewBg === 'game',
              'bg-[#202328] bg-[conic-gradient(#2c3036_25%,transparent_0_50%,#2c3036_0_75%,transparent_0)] bg-[size:20px_20px]':
                previewBg === 'checker',
            }"
          >
            <div
              ref="viewport"
              class="w-full h-full flex items-center justify-center"
            >
              <div
                class="relative shrink-0 outline-1 outline-dashed outline-slate-500/40"
                :style="
                  fullCanvas
                    ? { width: `${sourceWidth * scale}px`, height: `${sourceHeight * scale}px` }
                    : { width: '100%', height: '100%' }
                "
              >
                <div
                  class="absolute inset-0 origin-top-left overflow-hidden"
                  :style="stageStyle"
                >
                  <DanmujiOBS
                    v-if="previewVisible"
                    ref="preview"
                    preview
                    :config="config"
                    @ready="onPreviewReady"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 发送测试按钮条 -->
          <div class="flex items-center justify-between gap-2 pt-1 border-t border-border flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">测试:</span>
              <Button
                v-for="event in eventOptions"
                :key="event.value"
                size="xs"
                variant="outline"
                class="h-6 px-2"
                :disabled="!previewReady"
                @click="sendTest(event.value)"
              >
                {{ event.label }}
              </Button>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 text-muted-foreground"
              :disabled="!previewReady"
              @click="preview?.clearMessages()"
            >
              清空
            </Button>
          </div>

          <!-- 自动发送与频率 -->
          <div class="flex items-center justify-between gap-3 text-xs flex-wrap">
            <div class="flex items-center gap-2">
              <Switch
                :model-value="autoEnabled"
                :disabled="!previewReady"
                class="h-5 w-9"
                @update:model-value="(val) => toggleAuto(Boolean(val))"
              />
              <span class="text-muted-foreground select-none">自动轮播</span>
              <div class="flex items-center gap-1">
                <Input
                  size="xs"
                  v-model.number="interval"
                  type="number"
                  step="0.2"
                  min="0.3"
                  max="5"
                  class="w-16 font-mono"
                />
                <span class="text-muted-foreground">秒</span>
              </div>
            </div>

            <label class="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox v-model="randomize" />
              <span class="text-muted-foreground">随机内容</span>
            </label>
          </div>

          <!-- 测试消息详情字段 -->
          <div class="pt-2 border-t border-border space-y-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">测试消息参数</span>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="space-y-1">
                <span class="text-muted-foreground">用户名</span>
                <Input
                  size="xs"
                  v-model="testName"
                />
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">礼物名称</span>
                <Input
                  v-model="testGift"
                  size="xs"
                />
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">金额 (元)</span>
                <Input
                  size="xs"
                  v-model.number="testPrice"
                  type="number"
                  min="0"
                  class="font-mono"
                />
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">大航海等级</span>
                <Select v-model="testGuard">
                  <SelectTrigger size="xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3"> 舰长 </SelectItem>
                    <SelectItem value="2"> 提督 </SelectItem>
                    <SelectItem value="1"> 总督 </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="col-span-2 space-y-1">
                <span class="text-muted-foreground">弹幕内容</span>
                <Textarea
                  v-model="testMessage"
                  :rows="2"
                  class="text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
