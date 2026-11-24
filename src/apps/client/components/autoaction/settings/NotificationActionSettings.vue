<script setup lang="ts">
import { Bell, Globe, Monitor, Volume2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { playNotificationTone } from '@/apps/client/data/notificationSound'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useSettings } from '@/apps/client/store/useSettings'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Textarea } from '@/shared/ui/textarea'

const props = defineProps<{
  action: AutoActionItem
}>()

const router = useRouter()
const settingsStore = useSettings()

const showDesktopModel = computed({
  get: () => props.action.actionConfig.notificationShowDesktop ?? true,
  set: (val: boolean) => {
    props.action.actionConfig.notificationShowDesktop = val
  },
})

const showToastModel = computed({
  get: () => props.action.actionConfig.notificationShowToast ?? true,
  set: (val: boolean) => {
    props.action.actionConfig.notificationShowToast = val
  },
})

const playSoundModel = computed({
  get: () => props.action.actionConfig.notificationPlaySound ?? true,
  set: (val: boolean) => {
    props.action.actionConfig.notificationPlaySound = val
  },
})

const toastLevelModel = computed({
  get: () => props.action.actionConfig.notificationToastLevel ?? 'info',
  set: (val: string) => {
    props.action.actionConfig.notificationToastLevel = val as 'info' | 'success' | 'warning' | 'error'
  },
})

const soundPresetModel = computed({
  get: () => props.action.actionConfig.notificationSoundPreset ?? 'chime',
  set: (val: string) => {
    props.action.actionConfig.notificationSoundPreset = val as 'chime' | 'alert' | 'soft'
  },
})

const bypassGlobalModel = computed({
  get: () => Boolean(props.action.actionConfig.notificationBypassGlobalSwitch),
  set: (val: boolean) => {
    props.action.actionConfig.notificationBypassGlobalSwitch = val
  },
})

const obsNotifyTypeModel = computed({
  get: () => props.action.actionConfig.obsNotifyType ?? 'success',
  set: (val: string) => {
    props.action.actionConfig.obsNotifyType = val as 'success' | 'failed'
  },
})

const webhookMethodModel = computed({
  get: () => props.action.actionConfig.webhookMethod ?? 'POST',
  set: (val: string) => {
    props.action.actionConfig.webhookMethod = val as 'POST' | 'PUT'
  },
})

const toastLevelOptions = [
  { label: '普通信息', value: 'info' },
  { label: '成功提示', value: 'success' },
  { label: '警告提醒', value: 'warning' },
  { label: '异常告警', value: 'error' },
]

const soundPresetOptions = [
  { label: '清脆提示音', value: 'chime' },
  { label: '告警提示音', value: 'alert' },
  { label: '柔和提示音', value: 'soft' },
]

function previewTone() {
  const volume = settingsStore.settings.notificationSettings?.soundVolume ?? 0.5
  void playNotificationTone(soundPresetModel.value, volume)
}
</script>

<template>
  <!-- 1. 客户端桌面 / 应用内通知 -->
  <Card v-if="action.actionType === ActionType.SEND_NOTIFICATION">
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
        <Bell class="size-3.5 text-primary" />
        客户端通知配置
      </CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="通知标题（可选，支持变量）"
          description="留空时默认使用规则名称作为标题"
        >
          <Input
            v-model="action.actionConfig.notificationTitle"
            placeholder="例如：高额 SC 提醒 - {{user.name}}"
          />
        </FormField>

        <FormField
          type="select"
          label="应用内 Toast 样式"
          :options="toastLevelOptions"
          v-model="toastLevelModel"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SettingRow
          type="switch"
          variant="compact"
          title="发送系统桌面通知"
          description="在操作系统通知中心弹出提醒"
          v-model="showDesktopModel"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="显示应用内 Toast 弹窗"
          description="在客户端窗口内弹出浮层提醒"
          v-model="showToastModel"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="忽略“桌面通知总开关”"
          description="即使在客户端设置中关闭了桌面通知，此规则仍强制弹窗"
          v-model="bypassGlobalModel"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="播放提示音"
          description="触发通知时播放内置提示音"
          v-model="playSoundModel"
        />
      </div>

      <div
        v-if="playSoundModel"
        class="flex items-end gap-2 pt-1"
      >
        <FormField
          label="提示音音色"
          class="w-48"
        >
          <Select v-model="soundPresetModel">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in soundPresetOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <Button
          variant="secondary"
          class="gap-1.5"
          @click="previewTone"
        >
          <Volume2 class="size-3.5" />
          试听
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- 2. OBS 浮窗通知 -->
  <Card v-else-if="action.actionType === ActionType.OBS_NOTIFY">
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
        <Monitor class="size-3.5 text-primary" />
        OBS 浮窗通知配置
      </CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          type="select"
          label="通知类型"
          :options="[
            { label: '成功 / 普通通知', value: 'success' },
            { label: '告警 / 失败通知', value: 'failed' },
          ]"
          v-model="obsNotifyTypeModel"
        />

        <FormField label="通知标题（可选）">
          <Input
            v-model="action.actionConfig.obsNotifyTitle"
            placeholder="默认使用规则名称"
          />
        </FormField>

        <FormField label="Source 过滤标识">
          <Input
            v-model="action.actionConfig.obsNotifySource"
            placeholder="auto-action"
          />
        </FormField>
      </div>
    </CardContent>
  </Card>

  <!-- 3. TTS 语音播报 -->
  <Alert
    v-else-if="action.actionType === ActionType.SPEAK_TTS"
    size="sm"
  >
    <Volume2 class="size-4" />
    <AlertTitle>调用客户端 TTS 引擎直接播报</AlertTitle>
    <AlertDescription class="flex-between gap-3 flex-wrap mt-1">
      <span>将使用“读弹幕 / 语音播报”中配置的声源和音量直接朗读下方模板文本，无需开启读弹幕监听。</span>
      <Button
        variant="outline"
        size="xs"
        @click="router.push({ name: 'client-speech' })"
      >
        配置语音引擎
      </Button>
    </AlertDescription>
  </Alert>

  <!-- 4. Webhook HTTP 请求 -->
  <Card v-else-if="action.actionType === ActionType.SEND_WEBHOOK">
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
        <Globe class="size-3.5 text-primary" />
        Webhook HTTP 请求配置
      </CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <FormField
          label="请求方法"
          class="sm:col-span-1"
        >
          <Select v-model="webhookMethodModel">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="目标 URL（支持变量）"
          class="sm:col-span-3"
          :error="!action.actionConfig.webhookUrl?.trim() ? '请填写 Webhook 请求地址' : undefined"
        >
          <Input
            v-model="action.actionConfig.webhookUrl"
            placeholder="https://example.com/webhook"
          />
        </FormField>
      </div>

      <FormField
        label="自定义请求头 JSON（可选）"
        description="例如：{&quot;Authorization&quot;: &quot;Bearer token&quot;}；默认自动附带 Content-Type: application/json"
      >
        <Textarea
          v-model="action.actionConfig.webhookHeadersJson"
          :rows="2"
          placeholder="{}"
          class="font-mono text-xs"
        />
      </FormField>

      <FormField
        label="自定义请求体模板（可选，支持变量）"
        description="留空时自动发送包含 actionName、triggerType、roomId、message、user、live、system 的标准 JSON 载荷"
      >
        <Textarea
          v-model="action.actionConfig.webhookBodyTemplate"
          :rows="3"
          placeholder='{"text": "{{user.name}}: {{message}}"}'
          class="font-mono text-xs"
        />
      </FormField>
    </CardContent>
  </Card>
</template>
