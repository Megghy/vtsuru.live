<script setup lang="ts">
import {
  FolderOpen,
  MousePointerClick,
  Radio,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wind,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import { useManagedTools, type ManagedToolDirTarget } from '@/apps/client/store/useManagedTools'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const managedTools = useManagedTools()
const { run } = useVtsAction()

const strengthVal = ref(50)
const windVal = ref(0)
const overrideSeconds = ref(5)
const setBaseValue = ref(false)
const selectedGroupId = ref('__all__')

const ndiCustomRes = ref(false)
const ndiWidth = ref(1920)
const ndiHeight = ref(1080)
const ndiUse5 = ref(true)

const NDI_RESOLUTION_PRESETS = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
] as const

function applyNdiResPreset(preset: { width: number; height: number }) {
  ndiCustomRes.value = true
  ndiWidth.value = preset.width
  ndiHeight.value = preset.height
}

watch(
  () => vts.physicsState,
  (state) => {
    if (!state) return
    strengthVal.value = Math.round(state.baseStrength)
    windVal.value = Math.round(state.baseWind)
  },
  { immediate: true },
)

watch(
  () => vts.ndiState,
  (state) => {
    if (!state) return
    ndiCustomRes.value = state.useCustomResolution
    ndiUse5.value = state.useNDI5
    if (state.customWidthNDI > 0) ndiWidth.value = state.customWidthNDI
    if (state.customHeightNDI > 0) ndiHeight.value = state.customHeightNDI
  },
  { immediate: true },
)

const dirButtons: Array<{ target: ManagedToolDirTarget; label: string; key: 'models' | 'items' | 'backgrounds' | 'config' }> = [
  { target: 'vts_models', label: '模型目录', key: 'models' },
  { target: 'vts_items', label: '道具目录', key: 'items' },
  { target: 'vts_backgrounds', label: '背景目录', key: 'backgrounds' },
  { target: 'vts_config', label: '配置目录', key: 'config' },
]

const clickTimeText = computed(() => {
  if (!vts.lastModelClick) return ''
  return new Date(vts.lastModelClick.ts).toLocaleTimeString()
})

function applyPhysics() {
  run(
    () =>
      vts.setModelPhysics({
        strength: strengthVal.value,
        wind: windVal.value,
        overrideSeconds: overrideSeconds.value,
        setBaseValue: setBaseValue.value,
        groupId: selectedGroupId.value === '__all__' ? '' : selectedGroupId.value,
      }),
    '已应用物理设置',
  )
}

function toggleNdi(active: boolean) {
  run(
    () =>
      vts.updateNdiConfig({
        ndiActive: active,
        useNDI5: ndiUse5.value,
        useCustomResolution: ndiCustomRes.value,
        customWidthNDI: ndiCustomRes.value ? ndiWidth.value : -1,
        customHeightNDI: ndiCustomRes.value ? ndiHeight.value : -1,
      }),
    active ? '已开启 VTS NDI 输出' : '已关闭 VTS NDI 输出',
  )
}

function saveNdiSettings() {
  run(
    () =>
      vts.updateNdiConfig({
        ndiActive: vts.ndiState?.ndiActive ?? true,
        useNDI5: ndiUse5.value,
        useCustomResolution: ndiCustomRes.value,
        customWidthNDI: ndiCustomRes.value ? ndiWidth.value : -1,
        customHeightNDI: ndiCustomRes.value ? ndiHeight.value : -1,
      }),
    '已更新 NDI 输出配置',
  )
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
    <!-- 物理直控 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Wind class="size-4 text-primary" />
          <CardTitle>模型物理直控</CardTitle>
          <Badge
            v-if="vts.physicsState"
            :variant="vts.physicsState.physicsSwitchedOn ? 'success' : 'secondary'"
            size="xs"
          >
            {{ vts.physicsState.physicsSwitchedOn ? `${vts.physicsState.physicsFPSSetting} FPS` : '已关闭' }}
          </Badge>
        </div>
        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="!vts.connected"
            @click="run(() => vts.resetPhysicsDirect(), '已重置模型物理')"
          >
            <RotateCcw class="size-3" />
            一键重置
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            :disabled="!vts.connected"
            @click="run(() => vts.refreshPhysics(), '已刷新物理状态')"
          >
            <RefreshCw class="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <Empty
          v-if="!vts.connected"
          description="连接 VTS 后可直接调整模型物理强度与风力，无需绑定热键"
        />
        <Empty
          v-else-if="!vts.physicsState?.modelHasPhysics"
          description="当前模型未包含物理文件 (.physics3.json)"
        />
        <template v-else>
          <FormField
            v-if="vts.physicsState.physicsGroups.length > 0"
            label="作用物理分组"
          >
            <Select v-model="selectedGroupId">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全局基础物理</SelectItem>
                <SelectItem
                  v-for="g in vts.physicsState.physicsGroups"
                  :key="g.groupID"
                  :value="g.groupID"
                >
                  {{ g.groupName }} (强度×{{ g.strengthMultiplier.toFixed(1) }} / 风力×{{ g.windMultiplier.toFixed(1) }})
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="物理强度"
            :extra="`${strengthVal}`"
          >
            <Slider
              :model-value="[strengthVal]"
              :min="0"
              :max="100"
              :step="1"
              @update:model-value="(v) => (strengthVal = v?.[0] ?? 50)"
            />
          </FormField>

          <FormField
            label="风力效果"
            :extra="`${windVal}`"
          >
            <Slider
              :model-value="[windVal]"
              :min="0"
              :max="100"
              :step="1"
              @update:model-value="(v) => (windVal = v?.[0] ?? 0)"
            />
          </FormField>

          <div class="grid grid-cols-2 gap-2.5 items-end">
            <FormField label="持续覆盖时长 (秒)">
              <NumberField
                v-model="overrideSeconds"
                :min="0.5"
                :max="5"
                :step="0.5"
              />
            </FormField>
            <SettingRow
              type="switch"
              variant="compact"
              title="设为常驻基准"
              description="覆盖全局基础值"
              v-model="setBaseValue"
            />
          </div>

          <div class="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="xs"
              @click="
                () => {
                  strengthVal = 50
                  windVal = 0
                  applyPhysics()
                }
              "
            >
              恢复默认 (50 / 0)
            </Button>
            <Button
              size="xs"
              class="gap-1"
              @click="applyPhysics"
            >
              <Sparkles class="size-3" />
              应用物理
            </Button>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- NDI 输出 & 目录 & 交互监测 -->
    <div class="space-y-3.5">
      <Card>
        <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Radio class="size-4 text-primary" />
            <CardTitle>NDI 输出配置</CardTitle>
            <Badge
              v-if="vts.ndiState"
              :variant="vts.ndiState.ndiActive ? 'success' : 'secondary'"
              size="xs"
            >
              {{ vts.ndiState.ndiActive ? '输出中' : '已关闭' }}
            </Badge>
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            :disabled="!vts.connected"
            @click="run(() => vts.refreshNdiConfig(), '已刷新 NDI 状态')"
          >
            <RefreshCw class="size-3.5" />
          </Button>
        </CardHeader>

        <CardContent class="p-3 space-y-3">
          <Empty
            v-if="!vts.connected || !vts.ndiState"
            description="连接 VTS 后可直接控制 NDI 推流输出开关与分辨率"
          />
          <template v-else>
            <SettingRow
              type="switch"
              variant="none"
              title="启用 NDI 输出"
              description="允许 OBS 通过 NDI 插件透明采集 VTube Studio 画面"
              :model-value="vts.ndiState.ndiActive"
              @update:model-value="toggleNdi"
            />
            <SettingRow
              type="switch"
              variant="none"
              title="使用 NDI 5 协议"
              v-model="ndiUse5"
            />
            <SettingRow
              type="switch"
              variant="none"
              title="自定义输出分辨率"
              v-model="ndiCustomRes"
            />
            <div
              v-if="ndiCustomRes"
              class="space-y-2"
            >
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] text-muted-foreground">快捷分辨率:</span>
                <Button
                  v-for="preset in NDI_RESOLUTION_PRESETS"
                  :key="preset.label"
                  type="button"
                  size="xs"
                  :variant="ndiWidth === preset.width && ndiHeight === preset.height ? 'default' : 'outline'"
                  @click="applyNdiResPreset(preset)"
                >
                  {{ preset.label }}
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <FormField label="宽度 (px)">
                  <NumberField
                    v-model="ndiWidth"
                    :min="256"
                    :max="3840"
                    :step="16"
                  />
                </FormField>
                <FormField label="高度 (px)">
                  <NumberField
                    v-model="ndiHeight"
                    :min="256"
                    :max="2160"
                    :step="16"
                  />
                </FormField>
              </div>
            </div>
            <div class="flex justify-end">
              <Button
                size="xs"
                variant="outline"
                @click="saveNdiSettings"
              >
                保存 NDI 参数
              </Button>
            </div>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <FolderOpen class="size-4 text-primary" />
            <CardTitle>VTS 本地目录与交互监测</CardTitle>
          </div>
          <Badge
            v-if="vts.folderInfo"
            variant="outline"
            size="xs"
          >
            API 已获取路径
          </Badge>
        </CardHeader>

        <CardContent class="p-3 space-y-3">
          <ClientMinVersionNotice
            feature="vts-config"
            compact
          >
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                v-for="item in dirButtons"
                :key="item.target"
                variant="outline"
                size="xs"
                class="gap-1.5"
                @click="managedTools.openToolDir(item.target)"
              >
                <FolderOpen class="size-3" />
                {{ item.label }}
              </Button>
            </div>
          </ClientMinVersionNotice>

          <div class="rounded-md border border-border bg-muted/20 p-2.5 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-1.5 min-w-0">
              <MousePointerClick class="size-3.5 text-muted-foreground shrink-0" />
              <span
                v-if="vts.lastModelClick"
                class="truncate"
              >
                最近点击：{{ vts.lastModelClick.artMeshIDs.slice(0, 2).join(', ') || vts.lastModelClick.modelName }}
              </span>
              <span
                v-else
                class="text-muted-foreground"
              >
                尚未检测到模型点击事件（点击 VTS 中模型可在此定位 ArtMesh）
              </span>
            </div>
            <span
              v-if="clickTimeText"
              class="text-[11px] text-muted-foreground tabular-nums shrink-0"
            >
              {{ clickTimeText }}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
