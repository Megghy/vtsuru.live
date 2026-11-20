<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import PngtuberCollabCard from '@/shared/pngtuber/PngtuberCollabCard.vue'
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'

import ClientPageHeader from '../components/ClientPageHeader.vue'
import { useOBSStore } from '../store/useOBSStore'
import { usePngtuberDriver } from '../store/usePngtuberDriver'

const message = useMessage()
const driver = usePngtuberDriver()
const obs = useOBSStore()
const locked = computed(() => driver.running || driver.starting)
const deviceOptions = computed(() => [
  { label: '系统默认麦克风', value: 'default' },
  ...driver.devices
    .filter((device) => Boolean(device.deviceId) && device.deviceId !== 'default')
    .map((device) => ({ label: device.label || device.deviceId, value: device.deviceId })),
])
const inputOptions = computed(() => obs.obsInputs.map((name) => ({ label: name, value: name })))
const expressions = computed(() =>
  driver.config.expressions.map((expression) => ({
    label: `${expression.name} · ${expression.id}`,
    value: expression.id,
  })),
)
const settingsLink = computed(() => ({
  name: 'client-pngtuber-model',
  query: { channel: driver.channel || 'default' },
}))

async function refreshInputs() {
  try {
    await obs.fetchObsInputs()
  } catch (cause) {
    message.error(String(cause))
  }
}

async function control(patch: { expressionId?: string; muted?: boolean; away?: boolean }) {
  try {
    await driver.control(patch)
  } catch (cause) {
    message.error(String(cause))
  }
}

async function handleCollabPatch(patch: Partial<typeof driver.config>) {
  try {
    await driver.patchConfig(patch)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : String(cause))
  }
}

onMounted(() => {
  void driver.refreshDevices()
  void driver.loadConfig()
  void refreshInputs()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <ClientPageHeader
      title="PNGtuber"
      description="在客户端持续驱动立绘，切换页面后继续运行。"
    >
      <template #actions>
        <RouterLink :to="settingsLink">
          <Button variant="outline">完整模型设置</Button>
        </RouterLink>
      </template>
    </ClientPageHeader>

    <Alert
      v-if="driver.statusError"
      variant="destructive"
    >
      <AlertTitle>驱动提示</AlertTitle>
      <AlertDescription>{{ driver.statusError }}</AlertDescription>
    </Alert>

    <Card>
      <CardHeader class="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle>音频驱动</CardTitle>
        <Tag :variant="driver.running && driver.connected ? 'default' : 'secondary'">
          {{ driver.starting ? '正在启动' : driver.running ? (driver.connected ? '运行中' : '等待连接') : '已停止' }}
        </Tag>
      </CardHeader>
      <CardContent class="px-4 pb-4 space-y-4">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <FormField
            label="频道"
            class="min-w-0"
          >
            <Input
              v-model="driver.channel"
              placeholder="default"
              :disabled="locked"
            />
          </FormField>
          <FormField
            label="音频来源"
            class="min-w-0"
          >
            <Select
              v-model="driver.audioMode"
              :disabled="locked"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择音频来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="microphone">客户端麦克风</SelectItem>
                <SelectItem value="obs">OBS 输入源</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            v-if="driver.audioMode === 'microphone'"
            label="麦克风设备"
            class="min-w-0"
          >
            <Select
              v-model="driver.deviceId"
              :disabled="locked"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择麦克风设备" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in deviceOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            v-else
            label="OBS 输入源"
            class="min-w-0"
          >
            <Select
              v-model="driver.obsInput"
              :disabled="locked"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择音频输入源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in inputOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            v-if="!locked"
            @click="driver.start"
          >
            启动驱动
          </Button>
          <Button
            v-else
            variant="outline"
            @click="driver.stop"
          >
            停止驱动
          </Button>
          <Button
            variant="secondary"
            :disabled="locked"
            @click="driver.audioMode === 'microphone' ? driver.refreshDevices() : refreshInputs()"
          >
            刷新设备
          </Button>
          <RouterLink
            v-if="driver.audioMode === 'obs'"
            :to="{ name: 'client-live-manage' }"
            class="text-xs text-primary underline"
          >
            {{ obs.obsConnected ? 'OBS 已连接' : '前往连接 OBS' }}
          </RouterLink>
        </div>

        <p class="text-xs text-[var(--muted-foreground)]">
          启动时申请音频权限。更换频道或音频来源前请停止驱动。展示页输入模式请选择客户端或 OBS。
        </p>
      </CardContent>
    </Card>

    <PngtuberCollabCard
      :state="driver.config"
      :channel="driver.channel"
      @patch="handleCollabPatch"
    />

    <Card>
      <CardHeader class="py-3 px-4">
        <CardTitle>实时状态</CardTitle>
      </CardHeader>
      <CardContent class="px-4 pb-4 space-y-4">
        <div class="flex items-center gap-3">
          <Tag :variant="driver.speaking ? 'default' : 'secondary'">
            {{ driver.speaking ? '说话中' : '静默' }}
          </Tag>
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ driver.inputMuted ? 'OBS 输入已静音' : `音量 ${Math.round(driver.volume)}` }}
          </span>
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ driver.connected ? '控制连接正常' : '控制未连接' }}
          </span>
        </div>

        <Progress :model-value="Math.min(100, Math.max(0, Math.round(driver.volume)))" />

        <div
          class="space-y-2.5 max-w-md"
          :class="{ 'opacity-50 pointer-events-none': !driver.running || !driver.connected }"
        >
          <SettingRow
            variant="none"
            title="表情"
          >
            <div class="w-56">
              <Select
                :model-value="driver.runtime.expressionId || driver.config.defaultExpressionId"
                @update:model-value="(value) => control({ expressionId: String(value) })"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择表情" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="exp in expressions"
                    :key="exp.value"
                    :value="exp.value"
                  >
                    {{ exp.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingRow>

          <SettingRow
            variant="none"
            title="静音"
          >
            <Switch
              :checked="driver.runtime.muted"
              @update:checked="(value) => control({ muted: value })"
            />
          </SettingRow>

          <SettingRow
            variant="none"
            title="暂离"
          >
            <Switch
              :checked="driver.runtime.away"
              @update:checked="(value) => control({ away: value })"
            />
          </SettingRow>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <RouterLink :to="settingsLink">
            <Button variant="outline">表情、快捷键与完整设置</Button>
          </RouterLink>
          <RouterLink :to="{ name: 'client-auto-action-manage' }">
            <Button variant="outline">配置自动操作</Button>
          </RouterLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
