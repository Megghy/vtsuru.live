<script setup lang="ts">
import {
  CheckCircle2,
  Code2,
  FileUp,
  Link2,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { uploadObsSceneVfxAsset } from '@/api/obs-scene'
import type { RpcObsFilterCapabilities } from '@/shared/rpc/contract'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import {
  getObsColorPreset,
  getObsShaderFilterPreset,
  OBS_BUILTIN_LUT_PRESETS,
  OBS_COLOR_PRESETS,
  OBS_SHADER_FILTER_PRESETS,
} from '../vfx/presets'
import type { ObsColorPresetId, ObsNativeFilterConfig } from '../vfx/types'
import { createDefaultObsNativeFilterConfig } from '../vfx/types'
import SceneHelpTip from './SceneHelpTip.vue'

const props = defineProps<{
  /** 目标说明：'scene' 作用于整个 OBS 场景，'source' 作用于单个本地源 */
  scope: 'scene' | 'source'
  targetName?: string
  modelValue?: ObsNativeFilterConfig
  obsConnected: boolean
  filterCapabilities?: RpcObsFilterCapabilities
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ObsNativeFilterConfig]
  commit: []
  syncNow: []
  refreshCapabilities: []
  openObsLink: []
}>()

const lutFileInput = ref<HTMLInputElement | null>(null)
const shaderFileInput = ref<HTMLInputElement | null>(null)
const uploadingLut = ref(false)
const hlslDialogOpen = ref(false)
const hlslCodeDraft = ref('')

const cfg = computed<ObsNativeFilterConfig>(() => props.modelValue ?? createDefaultObsNativeFilterConfig())
const activeShaderPreset = computed(() => getObsShaderFilterPreset(cfg.value.shaderFilter.presetId))

function ensureAndMutate(mutator: (draft: ObsNativeFilterConfig) => void, commitNow = false) {
  const next: ObsNativeFilterConfig = props.modelValue
    ? (JSON.parse(JSON.stringify(props.modelValue)) as ObsNativeFilterConfig)
    : createDefaultObsNativeFilterConfig()
  mutator(next)
  emit('update:modelValue', next)
  if (commitNow) emit('commit')
}

function toggleMaster(enabled: boolean) {
  ensureAndMutate((d) => {
    d.enabled = enabled
    if (enabled && !d.color.enabled && !d.sharpness.enabled && !d.lut.enabled && !d.shaderFilter.enabled) {
      d.color.enabled = true
    }
  }, true)
}

function onSelectColorPreset(val: unknown) {
  const id = String(val ?? 'none') as ObsColorPresetId
  ensureAndMutate((d) => {
    d.enabled = true
    d.colorPreset = id
    if (id === 'none') {
      d.color.enabled = false
      const zero = getObsColorPreset('none')!
      Object.assign(d.color, zero.values)
    } else if (id !== 'custom') {
      const preset = getObsColorPreset(id)
      if (preset) {
        d.color.enabled = true
        Object.assign(d.color, preset.values)
      }
    } else {
      d.color.enabled = true
    }
  }, true)
}

function updateColorField<K extends keyof ObsNativeFilterConfig['color']>(
  key: K,
  value: ObsNativeFilterConfig['color'][K],
  commitNow = false,
) {
  ensureAndMutate((d) => {
    d.enabled = true
    d.color.enabled = true
    d.color[key] = value
    if (key !== 'enabled') d.colorPreset = 'custom'
  }, commitNow)
}

function onSelectLutPreset(val: unknown) {
  const id = String(val ?? 'teal-orange')
  ensureAndMutate((d) => {
    d.enabled = true
    d.lut.enabled = true
    d.lut.presetId = id
  }, true)
}

async function handleLutFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const lower = file.name.toLowerCase()
  uploadingLut.value = true
  try {
    if (lower.endsWith('.cube') && file.size <= 180 * 1024) {
      // 小型 .cube 文件直接读取文本内联（无需云端上传接口也可经桌面客户端自动落盘）
      const text = await file.text()
      ensureAndMutate((d) => {
        d.enabled = true
        d.lut.enabled = true
        d.lut.presetId = 'custom'
        d.lut.inlineCubeText = text
        d.lut.customUrl = undefined
        d.lut.customPath = undefined
        d.lut.customName = file.name
      }, true)
      toast.success(`已导入 3D LUT：${file.name}`)
      return
    }
    const uploaded = await uploadObsSceneVfxAsset(file)
    ensureAndMutate((d) => {
      d.enabled = true
      d.lut.enabled = true
      d.lut.presetId = 'custom'
      d.lut.customUrl = uploaded.url
      d.lut.inlineCubeText = undefined
      d.lut.customName = file.name
    }, true)
    toast.success(`已上传 LUT 文件：${file.name}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '导入 LUT 失败（也可在下方直接填写本机路径）')
  } finally {
    uploadingLut.value = false
  }
}

function onSelectShaderPreset(val: unknown) {
  const id = String(val ?? 'rgb-split')
  ensureAndMutate((d) => {
    d.enabled = true
    d.shaderFilter.enabled = true
    d.shaderFilter.presetId = id
    if (id !== 'custom') {
      const tpl = getObsShaderFilterPreset(id)
      if (!d.shaderFilter.customCode) d.shaderFilter.customCode = tpl.hlslCode
    }
  }, true)
}

function openHlslDialog() {
  hlslCodeDraft.value =
    cfg.value.shaderFilter.presetId === 'custom' && cfg.value.shaderFilter.customCode
      ? cfg.value.shaderFilter.customCode
      : activeShaderPreset.value.hlslCode
  hlslDialogOpen.value = true
}

function saveHlslDialog() {
  ensureAndMutate((d) => {
    d.enabled = true
    d.shaderFilter.enabled = true
    d.shaderFilter.presetId = 'custom'
    d.shaderFilter.customCode = hlslCodeDraft.value
    d.shaderFilter.customName = d.shaderFilter.customName || 'custom.shader'
  }, true)
  hlslDialogOpen.value = false
  toast.success('已保存自定义 OBS Shader 源码')
}

async function handleShaderFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 128 * 1024) {
    toast.error('着色器源码文件不能超过 128 KB')
    return
  }
  const text = await file.text()
  ensureAndMutate((d) => {
    d.enabled = true
    d.shaderFilter.enabled = true
    d.shaderFilter.presetId = 'custom'
    d.shaderFilter.customCode = text
    d.shaderFilter.customName = file.name
  }, true)
  toast.success(`已载入着色器：${file.name}`)
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex-between gap-2">
      <div class="flex items-center gap-1 min-w-0">
        <SlidersHorizontal class="size-3.5 text-primary shrink-0" />
        <span class="text-xs font-semibold text-foreground truncate">
          {{ scope === 'scene' ? 'OBS 场景原生画面滤镜' : 'OBS 原生源滤镜' }}
        </span>
        <SceneHelpTip
          :text="
            scope === 'scene'
              ? '通过 OBS WebSocket 直接挂载到整个 OBS 场景上，真正作用于游戏画面、摄像头、VTS 立绘与所有叠层的像素级调色、LUT 与 Shader 后处理。'
              : '通过 OBS WebSocket 直接挂载到该本地源（例如单独给摄像头美颜调色、给皮套加 LUT），不会影响场景中其他画面。'
          "
        />
      </div>
      <Badge v-if="cfg.enabled" variant="secondary" class="shrink-0">已启用</Badge>
    </div>

    <SettingRow
      variant="none"
      :title="scope === 'scene' ? '启用场景原生滤镜' : '启用该源原生滤镜'"
      description="由 OBS 零延迟 GPU 执行，自动隔离为 [VTsuru] 前缀不干扰你的手动滤镜"
    >
      <Switch :model-value="cfg.enabled" @update:model-value="(v) => toggleMaster(Boolean(v))" />
    </SettingRow>

    <template v-if="cfg.enabled">
      <!-- 1. OBS 内置色彩校正 (color_filter_v2) -->
      <div class="rounded-md border border-border bg-muted/20 p-2.5 space-y-2.5">
        <SettingRow variant="none" title="色彩校正 (内置)">
          <Switch
            :model-value="cfg.color.enabled"
            @update:model-value="(v) => ensureAndMutate((d) => { d.color.enabled = Boolean(v) }, true)"
          />
        </SettingRow>

        <template v-if="cfg.color.enabled">
          <FormField label="预置调色风格">
            <Select :model-value="cfg.colorPreset" @update:model-value="onSelectColorPreset">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in OBS_COLOR_PRESETS" :key="p.id" :value="p.id">
                  {{ p.label }}
                </SelectItem>
                <SelectItem value="custom">自定义参数</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="伽马 (Gamma)" :extra="cfg.color.gamma.toFixed(2)">
            <Slider
              :model-value="[cfg.color.gamma]"
              :min="-2"
              :max="2"
              :step="0.02"
              @update:model-value="(v) => v?.[0] !== undefined && updateColorField('gamma', v[0])"
              @value-commit="emit('commit')"
            />
          </FormField>
          <FormField label="对比度 (Contrast)" :extra="cfg.color.contrast.toFixed(2)">
            <Slider
              :model-value="[cfg.color.contrast]"
              :min="-1"
              :max="1.5"
              :step="0.02"
              @update:model-value="(v) => v?.[0] !== undefined && updateColorField('contrast', v[0])"
              @value-commit="emit('commit')"
            />
          </FormField>
          <FormField label="亮度 (Brightness)" :extra="cfg.color.brightness.toFixed(2)">
            <Slider
              :model-value="[cfg.color.brightness]"
              :min="-0.8"
              :max="0.8"
              :step="0.01"
              @update:model-value="(v) => v?.[0] !== undefined && updateColorField('brightness', v[0])"
              @value-commit="emit('commit')"
            />
          </FormField>
          <FormField label="饱和度 (Saturation)" :extra="cfg.color.saturation.toFixed(2)">
            <Slider
              :model-value="[cfg.color.saturation]"
              :min="-1"
              :max="2"
              :step="0.02"
              @update:model-value="(v) => v?.[0] !== undefined && updateColorField('saturation', v[0])"
              @value-commit="emit('commit')"
            />
          </FormField>
          <FormField label="色相偏移 (Hue)" :extra="`${Math.round(cfg.color.hueShift)}°`">
            <Slider
              :model-value="[cfg.color.hueShift]"
              :min="-180"
              :max="180"
              :step="1"
              @update:model-value="(v) => v?.[0] !== undefined && updateColorField('hueShift', v[0])"
              @value-commit="emit('commit')"
            />
          </FormField>

          <div class="grid grid-cols-2 gap-2">
            <FormField label="色罩乘色" class="min-w-0">
              <ColorPicker
                :model-value="cfg.color.colorMultiply"
                @update:model-value="(v) => updateColorField('colorMultiply', v, true)"
              />
            </FormField>
            <FormField label="暗部补色" class="min-w-0">
              <ColorPicker
                :model-value="cfg.color.colorAdd"
                @update:model-value="(v) => updateColorField('colorAdd', v, true)"
              />
            </FormField>
          </div>
        </template>
      </div>

      <!-- 2. OBS 内置锐化 (sharpness_filter_v2) -->
      <div class="rounded-md border border-border bg-muted/20 p-2.5 space-y-2.5">
        <SettingRow variant="none" title="画面锐化 (内置)">
          <Switch
            :model-value="cfg.sharpness.enabled"
            @update:model-value="(v) => ensureAndMutate((d) => { d.sharpness.enabled = Boolean(v) }, true)"
          />
        </SettingRow>
        <FormField
          v-if="cfg.sharpness.enabled"
          label="锐化强度"
          :extra="`${Math.round(cfg.sharpness.amount * 100)}%`"
        >
          <Slider
            :model-value="[cfg.sharpness.amount]"
            :min="0"
            :max="1"
            :step="0.02"
            @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.sharpness.amount = v[0] })"
            @value-commit="emit('commit')"
          />
        </FormField>
      </div>

      <!-- 3. OBS 内置 3D LUT 调色 (color_grade_filter) -->
      <div class="rounded-md border border-border bg-muted/20 p-2.5 space-y-2.5">
        <SettingRow
          variant="none"
          title="3D LUT 电影调色 (.cube / .png)"
          description="连接桌面客户端可自动落盘内置与云端 LUT"
        >
          <Switch
            :model-value="cfg.lut.enabled"
            @update:model-value="(v) => ensureAndMutate((d) => { d.lut.enabled = Boolean(v) }, true)"
          />
        </SettingRow>

        <template v-if="cfg.lut.enabled">
          <input
            ref="lutFileInput"
            type="file"
            accept=".cube,.png"
            class="hidden"
            @change="handleLutFileSelected"
          />

          <FormField label="LUT 方案">
            <Select :model-value="cfg.lut.presetId" @update:model-value="onSelectLutPreset">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in OBS_BUILTIN_LUT_PRESETS" :key="l.id" :value="l.id">
                  {{ l.label }}
                </SelectItem>
                <SelectItem value="custom">自定义 .cube / .png LUT</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <template v-if="cfg.lut.presetId === 'custom'">
            <div class="flex items-center gap-1.5">
              <Button variant="secondary" size="xs" class="flex-1" :disabled="uploadingLut" @click="lutFileInput?.click()">
                <FileUp class="size-3.5" />
                <span>{{ uploadingLut ? '导入中...' : cfg.lut.customName ? `已载入: ${cfg.lut.customName}` : '导入 .cube / .png' }}</span>
              </Button>
            </div>
            <FormField
              label="本机绝对路径（网页直连模式可选填）"
              hint="例如 C:\\LUTs\\cinema.cube；使用桌面客户端导入时无需手填。"
            >
              <Input
                :model-value="cfg.lut.customPath ?? ''"
                placeholder="可选：填写本机 .cube 或 .png 绝对路径"
                @update:model-value="(v) => ensureAndMutate((d) => { d.lut.customPath = String(v).trim() || undefined })"
                @blur="emit('commit')"
              />
            </FormField>
          </template>

          <FormField label="LUT 混合强度" :extra="`${Math.round(cfg.lut.amount * 100)}%`">
            <Slider
              :model-value="[cfg.lut.amount]"
              :min="0"
              :max="1"
              :step="0.02"
              @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.lut.amount = v[0] })"
              @value-commit="emit('commit')"
            />
          </FormField>
        </template>
      </div>

      <!-- 4. obs-shaderfilter 高级像素后处理（插件探测增强） -->
      <div class="rounded-md border border-border bg-muted/20 p-2.5 space-y-2.5">
        <div class="flex-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <Sparkles class="size-3.5 text-violet-500 shrink-0" />
            <span class="text-xs font-medium text-foreground truncate">obs-shaderfilter 后处理</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Badge v-if="filterCapabilities?.hasShaderFilter" variant="secondary" class="text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 class="size-3 mr-0.5" />
              已安装
            </Badge>
            <Badge v-else variant="outline">未检测到插件</Badge>
            <Switch
              :model-value="cfg.shaderFilter.enabled"
              @update:model-value="(v) => ensureAndMutate((d) => { d.shaderFilter.enabled = Boolean(v) }, true)"
            />
          </div>
        </div>

        <Alert v-if="obsConnected && !filterCapabilities?.hasShaderFilter">
          <AlertDescription class="text-[11px] flex-between gap-2">
            <span>需在 OBS 安装免费插件 <strong class="font-mono">obs-shaderfilter</strong> 以启用全画面扭曲/色差/CRT/像素化。</span>
            <Button variant="ghost" size="xs" class="shrink-0" @click="emit('refreshCapabilities')">
              <RefreshCw class="size-3" />
            </Button>
          </AlertDescription>
        </Alert>

        <template v-if="cfg.shaderFilter.enabled">
          <input
            ref="shaderFileInput"
            type="file"
            accept=".shader,.effect,.hlsl"
            class="hidden"
            @change="handleShaderFileSelected"
          />

          <FormField
            label="HLSL 着色器预设"
            :description="cfg.shaderFilter.presetId === 'custom' ? '自定义 obs-shaderfilter HLSL 源码' : activeShaderPreset.description"
          >
            <Select :model-value="cfg.shaderFilter.presetId" @update:model-value="onSelectShaderPreset">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="sp in OBS_SHADER_FILTER_PRESETS" :key="sp.id" :value="sp.id">
                  {{ sp.label }}
                </SelectItem>
                <SelectItem value="custom">自定义 .shader / .effect</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div class="flex items-center gap-1.5">
            <Button variant="secondary" size="xs" class="flex-1" @click="openHlslDialog">
              <Code2 class="size-3.5" />
              <span>编辑 HLSL 源码</span>
            </Button>
            <Button variant="outline" size="xs" title="导入本地 .shader/.effect 文件" @click="shaderFileInput?.click()">
              <FileUp class="size-3.5" />
            </Button>
          </div>

          <FormField label="强度 (intensity)" :extra="`${Math.round(cfg.shaderFilter.intensity * 100)}%`">
            <Slider
              :model-value="[cfg.shaderFilter.intensity]"
              :min="0"
              :max="1"
              :step="0.02"
              @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.shaderFilter.intensity = v[0] })"
              @value-commit="emit('commit')"
            />
          </FormField>

          <FormField label="速度 (speed)" :extra="`${cfg.shaderFilter.speed.toFixed(2)}x`">
            <Slider
              :model-value="[cfg.shaderFilter.speed]"
              :min="0"
              :max="3"
              :step="0.05"
              @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.shaderFilter.speed = v[0] })"
              @value-commit="emit('commit')"
            />
          </FormField>

          <div class="grid grid-cols-2 gap-2">
            <FormField :label="activeShaderPreset.param1Label" :extra="cfg.shaderFilter.param1.toFixed(2)" class="min-w-0">
              <Slider
                :model-value="[cfg.shaderFilter.param1]"
                :min="0"
                :max="1"
                :step="0.02"
                @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.shaderFilter.param1 = v[0] })"
                @value-commit="emit('commit')"
              />
            </FormField>
            <FormField :label="activeShaderPreset.param2Label" :extra="cfg.shaderFilter.param2.toFixed(2)" class="min-w-0">
              <Slider
                :model-value="[cfg.shaderFilter.param2]"
                :min="0"
                :max="1"
                :step="0.02"
                @update:model-value="(v) => v?.[0] !== undefined && ensureAndMutate((d) => { d.shaderFilter.param2 = v[0] })"
                @value-commit="emit('commit')"
              />
            </FormField>
          </div>
        </template>
      </div>

      <Separator />

      <Button
        v-if="obsConnected"
        variant="default"
        size="xs"
        class="w-full"
        @click="emit('syncNow')"
      >
        <Send class="size-3.5" />
        <span>立即同步滤镜到 OBS{{ targetName ? `（${targetName}）` : '' }}</span>
      </Button>
      <Button
        v-else
        variant="outline"
        size="xs"
        class="w-full"
        @click="emit('openObsLink')"
      >
        <Link2 class="size-3.5" />
        <span>连接本地 OBS 后应用原生滤镜</span>
      </Button>
    </template>

    <!-- HLSL 编辑弹窗 -->
    <Dialog v-model:open="hlslDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑 obs-shaderfilter HLSL 源码</DialogTitle>
          <DialogDescription>
            支持标准 OBS <code class="font-mono">.shader</code> / <code class="font-mono">.effect</code> 语法；定义 <code class="font-mono">intensity</code>、<code class="font-mono">speed</code>、<code class="font-mono">param1</code>、<code class="font-mono">param2</code> Uniform 可与右侧滑块自动绑定。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          v-model="hlslCodeDraft"
          rows="16"
          class="font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <DialogFooter>
          <Button variant="ghost" @click="hlslDialogOpen = false">取消</Button>
          <Button @click="saveHlslDialog">保存源码</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
