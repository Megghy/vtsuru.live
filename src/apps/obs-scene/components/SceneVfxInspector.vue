<script setup lang="ts">
import { Code2, Maximize2, RotateCcw, Sparkles, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { uploadObsSceneAsset, uploadObsSceneVfxAsset } from '@/api/obs-scene'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { VfxLayer } from '../types'
import {
  getVfxPresetMeta,
  getVfxShaderTemplate,
  VFX_BLEND_MODE_OPTIONS,
  VFX_PRESET_LIST,
  VFX_SHADER_TEMPLATES,
} from '../vfx/presets'
import type { VfxBlendMode, VfxLayerMode, VfxMediaAlphaMode, VfxMediaFormat, VfxPresetId } from '../vfx/types'
import { detectVfxMediaFormat } from '../vfx/types'
import SceneHelpTip from './SceneHelpTip.vue'

const props = defineProps<{
  layer: VfxLayer
}>()

const store = useObsSceneEditorStore()
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const shaderDialogOpen = ref(false)
const shaderCodeDraft = ref('')

const vfx = computed(() => props.layer.vfx)
const presetMeta = computed(() => getVfxPresetMeta(vfx.value.preset.id))
const shaderTemplate = computed(() => getVfxShaderTemplate(vfx.value.shader.templateId))

const overlayPresets = computed(() => VFX_PRESET_LIST.filter((p) => p.category === 'overlay'))
const particlePresets = computed(() => VFX_PRESET_LIST.filter((p) => p.category === 'particles'))
const backdropPresets = computed(() => VFX_PRESET_LIST.filter((p) => p.category === 'backdrop'))

const resolvedMediaFormat = computed(() => detectVfxMediaFormat(vfx.value.media.url, vfx.value.media.format))

function hasControl(key: 'intensity' | 'speed' | 'density' | 'size' | 'color1' | 'color2' | 'angle' | 'backdrop') {
  return presetMeta.value.controls.includes(key)
}

function onModeChange(val: unknown) {
  if (val !== 'preset' && val !== 'shader' && val !== 'media') return
  vfx.value.mode = val as VfxLayerMode
  store.pushHistory()
}

function onBlendModeChange(val: unknown) {
  if (!val) return
  vfx.value.blendMode = String(val) as VfxBlendMode
  store.pushHistory()
}

function onPresetSelect(val: unknown) {
  const id = String(val ?? '') as VfxPresetId
  const meta = getVfxPresetMeta(id)
  vfx.value.preset.id = meta.id
  Object.assign(vfx.value.preset, meta.defaults)
  vfx.value.blendMode = meta.recommendedBlendMode
  if (props.layer.name === '画面滤镜' || VFX_PRESET_LIST.some((p) => p.label === props.layer.name)) {
    props.layer.name = meta.label
  }
  store.pushHistory()
}

function onShaderTemplateSelect(val: unknown) {
  const id = String(val ?? '')
  const tpl = getVfxShaderTemplate(id)
  vfx.value.shader.templateId = tpl.id
  vfx.value.shader.fragmentCode = tpl.code
  vfx.value.shader.color1 = tpl.color1
  vfx.value.shader.color2 = tpl.color2
  vfx.value.shader.params = [0.5, 0.5, 0.5, 0.5]
  store.pushHistory()
}

function openShaderEditor() {
  shaderCodeDraft.value = vfx.value.shader.fragmentCode
  shaderDialogOpen.value = true
}

function applyShaderCode() {
  vfx.value.shader.fragmentCode = shaderCodeDraft.value
  shaderDialogOpen.value = false
  store.pushHistory()
  toast.success('已应用自定义 GLSL 着色器')
}

function resetShaderTemplate() {
  const tpl = getVfxShaderTemplate(vfx.value.shader.templateId)
  vfx.value.shader.fragmentCode = tpl.code
  shaderCodeDraft.value = tpl.code
  store.pushHistory()
}

function fitToCanvas() {
  const containerW = store.selectedParentGroup?.width ?? store.doc.canvas.width
  const containerH = store.selectedParentGroup?.height ?? store.doc.canvas.height
  store.updateLayer(props.layer.id, {
    x: 0,
    y: 0,
    width: containerW,
    height: containerH,
    rotation: 0,
  })
}

function updateShaderParam(index: 0 | 1 | 2 | 3, val: number | undefined) {
  if (val === undefined) return
  const next: [number, number, number, number] = [...vfx.value.shader.params]
  next[index] = val
  vfx.value.shader.params = next
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function handleVfxFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploading.value = true
  try {
    const lower = file.name.toLowerCase()
    const isImage = /\.(png|apng|webp|gif|jpe?g)$/.test(lower)
    let uploadedUrl = ''
    try {
      const res = await uploadObsSceneVfxAsset(file)
      uploadedUrl = res.url
    } catch (err) {
      if (isImage) {
        const imgRes = await uploadObsSceneAsset(file)
        uploadedUrl = imgRes.url
      } else {
        throw err
      }
    }
    vfx.value.media.url = uploadedUrl
    if (lower.endsWith('.mp4') || lower.endsWith('.mov')) {
      vfx.value.media.alphaMode = 'luma-key'
    } else if (lower.endsWith('.webm')) {
      vfx.value.media.alphaMode = 'native'
    }
    store.pushHistory()
    toast.success(`已上传 VFX 素材：${file.name}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '上传 VFX 素材失败（也可直接粘贴外链 URL）')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex-between gap-2">
      <div class="flex items-center gap-1 min-w-0">
        <Sparkles class="size-3.5 text-primary shrink-0" />
        <span class="text-xs font-semibold text-foreground truncate">画面滤镜与 VFX</span>
        <SceneHelpTip text="Web 画面滤镜/粒子/Shader/透明视频叠加层，无需额外 OBS 插件即可在透明浏览器源中生效。" />
      </div>
      <Button variant="outline" size="xs" title="一键铺满整个画布" @click="fitToCanvas">
        <Maximize2 class="size-3" />
        <span>铺满画布</span>
      </Button>
    </div>

    <FormField label="滤镜 / 特效模式">
      <ToggleGroup
        type="single"
        class="w-full grid grid-cols-3"
        :model-value="vfx.mode"
        @update:model-value="onModeChange"
      >
        <ToggleGroupItem value="preset">预置滤镜</ToggleGroupItem>
        <ToggleGroupItem value="shader">自定义 Shader</ToggleGroupItem>
        <ToggleGroupItem value="media">VFX 素材</ToggleGroupItem>
      </ToggleGroup>
    </FormField>

    <FormField
      label="图层混合模式"
      hint="滤色(Screen) 适合光效与粒子提亮；叠加/柔光适合胶片颗粒与色调罩。"
    >
      <Select :model-value="vfx.blendMode" @update:model-value="onBlendModeChange">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in VFX_BLEND_MODE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </FormField>

    <Separator />

    <!-- 模式 1：预置滤镜与动态粒子 -->
    <template v-if="vfx.mode === 'preset'">
      <FormField label="选择预置效果" :description="presetMeta.description">
        <Select :model-value="vfx.preset.id" @update:model-value="onPresetSelect">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>画面质感滤镜</SelectLabel>
              <SelectItem v-for="p in overlayPresets" :key="p.id" :value="p.id">
                {{ p.label }}
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>动态氛围粒子</SelectLabel>
              <SelectItem v-for="p in particlePresets" :key="p.id" :value="p.id">
                {{ p.label }}
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>同槽位 Web 局部后处理</SelectLabel>
              <SelectItem v-for="p in backdropPresets" :key="p.id" :value="p.id">
                {{ p.label }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        v-if="hasControl('intensity')"
        label="滤镜强度"
        :extra="`${Math.round(vfx.preset.intensity * 100)}%`"
      >
        <Slider
          :model-value="[vfx.preset.intensity]"
          :min="0"
          :max="1"
          :step="0.02"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.intensity = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <FormField
        v-if="hasControl('speed')"
        label="动态速度"
        :extra="`${vfx.preset.speed.toFixed(2)}x`"
      >
        <Slider
          :model-value="[vfx.preset.speed]"
          :min="0"
          :max="3"
          :step="0.05"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.speed = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <FormField
        v-if="hasControl('density')"
        label="密度 / 数量"
        :extra="`${Math.round(vfx.preset.density * 100)}%`"
      >
        <Slider
          :model-value="[vfx.preset.density]"
          :min="0.1"
          :max="2"
          :step="0.05"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.density = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <FormField
        v-if="hasControl('size')"
        label="尺寸 / 范围"
        :extra="`${vfx.preset.size.toFixed(2)}x`"
      >
        <Slider
          :model-value="[vfx.preset.size]"
          :min="0.2"
          :max="3"
          :step="0.05"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.size = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <FormField
        v-if="hasControl('angle')"
        label="方向角度"
        :extra="`${Math.round(vfx.preset.angle)}°`"
      >
        <Slider
          :model-value="[vfx.preset.angle]"
          :min="0"
          :max="360"
          :step="1"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.angle = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <div v-if="hasControl('color1') || hasControl('color2')" class="grid grid-cols-2 gap-2">
        <FormField v-if="hasControl('color1')" label="主色调" class="min-w-0">
          <ColorPicker
            :model-value="vfx.preset.color1"
            @update:model-value="(v) => { vfx.preset.color1 = v; store.pushHistory() }"
          />
        </FormField>
        <FormField v-if="hasControl('color2')" label="辅助色调" class="min-w-0">
          <ColorPicker
            :model-value="vfx.preset.color2"
            @update:model-value="(v) => { vfx.preset.color2 = v; store.pushHistory() }"
          />
        </FormField>
      </div>

      <!-- 同槽位 Web backdrop-filter 专属控件 -->
      <template v-if="hasControl('backdrop')">
        <Alert>
          <AlertDescription class="text-[11px]">
            仅作用于同一浏览器源槽位内位于本层下方的 Web 图层；如需对游戏/摄像头/VTS 等原生画面调色，请在未选中图层时的「OBS 原生画面滤镜」中配置。
          </AlertDescription>
        </Alert>

        <FormField label="背景模糊" :extra="`${vfx.preset.backdropBlur}px`">
          <Slider
            :model-value="[vfx.preset.backdropBlur]"
            :min="0"
            :max="64"
            :step="1"
            @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropBlur = v[0] }"
            @value-commit="store.pushHistory()"
          />
        </FormField>
        <FormField label="亮度" :extra="`${vfx.preset.backdropBrightness}%`">
          <Slider
            :model-value="[vfx.preset.backdropBrightness]"
            :min="20"
            :max="200"
            :step="2"
            @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropBrightness = v[0] }"
            @value-commit="store.pushHistory()"
          />
        </FormField>
        <FormField label="对比度" :extra="`${vfx.preset.backdropContrast}%`">
          <Slider
            :model-value="[vfx.preset.backdropContrast]"
            :min="20"
            :max="200"
            :step="2"
            @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropContrast = v[0] }"
            @value-commit="store.pushHistory()"
          />
        </FormField>
        <FormField label="饱和度" :extra="`${vfx.preset.backdropSaturate}%`">
          <Slider
            :model-value="[vfx.preset.backdropSaturate]"
            :min="0"
            :max="300"
            :step="5"
            @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropSaturate = v[0] }"
            @value-commit="store.pushHistory()"
          />
        </FormField>
        <FormField label="色相偏移" :extra="`${vfx.preset.backdropHueRotate}°`">
          <Slider
            :model-value="[vfx.preset.backdropHueRotate]"
            :min="-180"
            :max="180"
            :step="2"
            @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropHueRotate = v[0] }"
            @value-commit="store.pushHistory()"
          />
        </FormField>
        <div class="grid grid-cols-2 gap-2">
          <FormField label="灰度" :extra="`${vfx.preset.backdropGrayscale}%`" class="min-w-0">
            <Slider
              :model-value="[vfx.preset.backdropGrayscale]"
              :min="0"
              :max="100"
              :step="2"
              @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropGrayscale = v[0] }"
              @value-commit="store.pushHistory()"
            />
          </FormField>
          <FormField label="复古棕褐" :extra="`${vfx.preset.backdropSepia}%`" class="min-w-0">
            <Slider
              :model-value="[vfx.preset.backdropSepia]"
              :min="0"
              :max="100"
              :step="2"
              @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.preset.backdropSepia = v[0] }"
              @value-commit="store.pushHistory()"
            />
          </FormField>
        </div>
      </template>
    </template>

    <!-- 模式 2：自定义 GLSL Shader (Shadertoy 兼容) -->
    <template v-else-if="vfx.mode === 'shader'">
      <FormField label="内置 Shader 模板" :description="shaderTemplate.description">
        <Select :model-value="vfx.shader.templateId" @update:model-value="onShaderTemplateSelect">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tpl in VFX_SHADER_TEMPLATES" :key="tpl.id" :value="tpl.id">
              {{ tpl.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <div class="flex items-center gap-1.5">
        <Button variant="secondary" size="xs" class="flex-1" @click="openShaderEditor">
          <Code2 class="size-3.5" />
          <span>编辑 GLSL 代码</span>
        </Button>
        <Button variant="outline" size="xs" title="重置为模板默认代码" @click="resetShaderTemplate">
          <RotateCcw class="size-3.5" />
        </Button>
      </div>

      <FormField label="效果强度" :extra="`${Math.round(vfx.shader.intensity * 100)}%`">
        <Slider
          :model-value="[vfx.shader.intensity]"
          :min="0"
          :max="1"
          :step="0.02"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.shader.intensity = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <FormField label="播放速度" :extra="`${vfx.shader.speed.toFixed(2)}x`">
        <Slider
          :model-value="[vfx.shader.speed]"
          :min="0"
          :max="3"
          :step="0.05"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.shader.speed = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <div class="grid grid-cols-2 gap-2">
        <FormField label="主色 (uColor1)" class="min-w-0">
          <ColorPicker
            :model-value="vfx.shader.color1"
            @update:model-value="(v) => { vfx.shader.color1 = v; store.pushHistory() }"
          />
        </FormField>
        <FormField label="辅色 (uColor2)" class="min-w-0">
          <ColorPicker
            :model-value="vfx.shader.color2"
            @update:model-value="(v) => { vfx.shader.color2 = v; store.pushHistory() }"
          />
        </FormField>
      </div>

      <div class="space-y-2.5 pt-1">
        <div class="text-[11px] font-medium text-muted-foreground">自定义 Uniform 参数 (uParam1 ~ uParam4)</div>
        <FormField
          v-for="(label, idx) in shaderTemplate.paramLabels"
          :key="idx"
          :label="`uParam${idx + 1} · ${label}`"
          :extra="vfx.shader.params[idx].toFixed(2)"
        >
          <Slider
            :model-value="[vfx.shader.params[idx]]"
            :min="0"
            :max="1"
            :step="0.02"
            @update:model-value="(v) => updateShaderParam(idx as 0 | 1 | 2 | 3, v?.[0])"
            @value-commit="store.pushHistory()"
          />
        </FormField>
      </div>
    </template>

    <!-- 模式 3：外部 VFX 素材（WebM / 黑底 MP4 / APNG / Lottie / Rive / SVGA / PAG） -->
    <template v-else>
      <input
        ref="fileInputRef"
        type="file"
        accept=".webm,.mp4,.mov,.gif,.webp,.png,.apng,.json,.lottie,.riv,.svga,.pag"
        class="hidden"
        @change="handleVfxFileSelected"
      />

      <div class="flex items-center gap-1.5">
        <Button variant="secondary" size="xs" class="flex-1" :disabled="uploading" @click="triggerFileUpload">
          <Upload class="size-3.5" />
          <span>{{ uploading ? '上传中...' : '上传 VFX 素材' }}</span>
        </Button>
        <Badge variant="outline" class="shrink-0 uppercase">{{ resolvedMediaFormat }}</Badge>
      </div>

      <FormField
        label="素材地址 (URL)"
        hint="支持透明 WebM、黑底/绿幕 MP4、APNG/WebP、Lottie (.json/.lottie)、Rive (.riv)、SVGA (.svga)、PAG (.pag)。"
      >
        <Input
          :model-value="vfx.media.url"
          placeholder="https://... (.webm / .mp4 / .lottie / .riv / .svga / .pag)"
          @update:model-value="(v) => (vfx.media.url = String(v))"
          @blur="store.pushHistory()"
        />
      </FormField>

      <FormField label="素材格式">
        <Select
          :model-value="vfx.media.format"
          @update:model-value="(v) => { vfx.media.format = String(v ?? 'auto') as VfxMediaFormat; store.pushHistory() }"
        >
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">自动识别扩展名</SelectItem>
            <SelectItem value="video">视频 (WebM Alpha / 黑底 MP4 / MOV)</SelectItem>
            <SelectItem value="image">动图 (APNG / WebP / GIF)</SelectItem>
            <SelectItem value="lottie">Lottie 矢量动画 (.json / .lottie)</SelectItem>
            <SelectItem value="rive">Rive 交互动画 (.riv)</SelectItem>
            <SelectItem value="svga">SVGA 直播特效 (.svga)</SelectItem>
            <SelectItem value="pag">腾讯 PAG 特效 (.pag)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <!-- 视频专属去底与透明模式 -->
      <template v-if="resolvedMediaFormat === 'video'">
        <FormField
          label="视频透明处理"
          hint="黑底去黑可直接把 AE / 剪映的黑底光效 MP4 实时转为透明叠加，无需预先转码 WebM。"
        >
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-3"
            :model-value="vfx.media.alphaMode"
            @update:model-value="(v) => { if (v) { vfx.media.alphaMode = v as VfxMediaAlphaMode; store.pushHistory() } }"
          >
            <ToggleGroupItem value="native">原生透明</ToggleGroupItem>
            <ToggleGroupItem value="luma-key">黑底去黑</ToggleGroupItem>
            <ToggleGroupItem value="chroma-key">色键抠底</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <template v-if="vfx.media.alphaMode !== 'native'">
          <FormField v-if="vfx.media.alphaMode === 'chroma-key'" label="抠除底色">
            <ColorPicker
              :model-value="vfx.media.keyColor"
              @update:model-value="(v) => { vfx.media.keyColor = v; store.pushHistory() }"
            />
          </FormField>

          <FormField label="去底阈值" :extra="`${Math.round(vfx.media.keyThreshold * 100)}%`">
            <Slider
              :model-value="[vfx.media.keyThreshold]"
              :min="0"
              :max="0.8"
              :step="0.01"
              @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.media.keyThreshold = v[0] }"
              @value-commit="store.pushHistory()"
            />
          </FormField>

          <FormField label="边缘柔化" :extra="`${Math.round(vfx.media.keySmoothness * 100)}%`">
            <Slider
              :model-value="[vfx.media.keySmoothness]"
              :min="0.01"
              :max="0.5"
              :step="0.01"
              @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.media.keySmoothness = v[0] }"
              @value-commit="store.pushHistory()"
            />
          </FormField>

          <div class="grid grid-cols-2 gap-2">
            <FormField label="光效染色" class="min-w-0">
              <ColorPicker
                :model-value="vfx.media.tintColor"
                @update:model-value="(v) => { vfx.media.tintColor = v; store.pushHistory() }"
              />
            </FormField>
            <FormField label="染色强度" :extra="`${Math.round(vfx.media.tintStrength * 100)}%`" class="min-w-0">
              <Slider
                :model-value="[vfx.media.tintStrength]"
                :min="0"
                :max="1"
                :step="0.05"
                @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.media.tintStrength = v[0] }"
                @value-commit="store.pushHistory()"
              />
            </FormField>
          </div>
        </template>
      </template>

      <!-- Rive 专属可选参数 -->
      <div v-if="resolvedMediaFormat === 'rive'" class="grid grid-cols-2 gap-2">
        <FormField label="Artboard (可选)" class="min-w-0">
          <Input
            :model-value="vfx.media.riveArtboard ?? ''"
            placeholder="默认主画板"
            @update:model-value="(v) => (vfx.media.riveArtboard = String(v).trim() || undefined)"
            @blur="store.pushHistory()"
          />
        </FormField>
        <FormField label="State Machine" class="min-w-0">
          <Input
            :model-value="vfx.media.riveStateMachine ?? ''"
            placeholder="可选状态机名"
            @update:model-value="(v) => (vfx.media.riveStateMachine = String(v).trim() || undefined)"
            @blur="store.pushHistory()"
          />
        </FormField>
      </div>

      <FormField label="填充方式">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-3"
          :model-value="vfx.media.objectFit"
          @update:model-value="(v) => { if (v) { vfx.media.objectFit = v as 'contain' | 'cover' | 'fill'; store.pushHistory() } }"
        >
          <ToggleGroupItem value="contain">适应</ToggleGroupItem>
          <ToggleGroupItem value="cover">铺满</ToggleGroupItem>
          <ToggleGroupItem value="fill">拉伸</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <FormField
        v-if="resolvedMediaFormat === 'video' || resolvedMediaFormat === 'lottie'"
        label="播放倍速"
        :extra="`${vfx.media.playbackRate.toFixed(2)}x`"
      >
        <Slider
          :model-value="[vfx.media.playbackRate]"
          :min="0.25"
          :max="3"
          :step="0.05"
          @update:model-value="(v) => { if (v?.[0] !== undefined) vfx.media.playbackRate = v[0] }"
          @value-commit="store.pushHistory()"
        />
      </FormField>

      <SettingRow variant="none" title="循环播放">
        <Switch
          :model-value="vfx.media.loop"
          @update:model-value="(v) => { vfx.media.loop = Boolean(v); store.pushHistory() }"
        />
      </SettingRow>

      <SettingRow v-if="resolvedMediaFormat === 'video'" variant="none" title="静音播放">
        <Switch
          :model-value="vfx.media.muted"
          @update:model-value="(v) => { vfx.media.muted = Boolean(v); store.pushHistory() }"
        />
      </SettingRow>
    </template>

    <!-- GLSL 自定义代码弹窗 -->
    <Dialog v-model:open="shaderDialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑自定义 GLSL Fragment Shader</DialogTitle>
          <DialogDescription>
            支持 Shadertoy 约定函数 <code class="font-mono">void mainImage(out vec4 fragColor, in vec2 fragCoord)</code>。可用内置变量：
            <code class="font-mono">iTime</code>、<code class="font-mono">iResolution</code>、<code class="font-mono">uIntensity</code>、<code class="font-mono">uSpeed</code>、<code class="font-mono">uColor1</code>、<code class="font-mono">uColor2</code>、<code class="font-mono">uParam1~uParam4</code>。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          v-model="shaderCodeDraft"
          rows="16"
          class="font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <DialogFooter>
          <Button variant="outline" @click="resetShaderTemplate">恢复模板</Button>
          <Button variant="ghost" @click="shaderDialogOpen = false">取消</Button>
          <Button @click="applyShaderCode">应用着色器</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
