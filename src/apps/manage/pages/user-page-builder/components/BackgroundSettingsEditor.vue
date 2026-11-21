<script setup lang="ts">
import { Image as ImageIcon, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

type PageBackgroundType = 'none' | 'color' | 'image'
type PageBackgroundBlurMode = 'none' | 'background' | 'glass'
type PageBackgroundImageFit = 'cover' | 'contain' | 'fill' | 'none'
type PageBackgroundScrimMode = 'auto' | 'black' | 'white'

export interface BackgroundSettingsTarget {
  get: () => Record<string, any> | null | undefined
  ensure: () => Record<string, any> | null
  uploadImage?: () => void
  clearImage?: () => void
}

const props = defineProps<{
  target: BackgroundSettingsTarget
  noneHint?: string
}>()

const type = computed<PageBackgroundType>({
  get() {
    const t = props.target.get()
    const v = t?.pageBackgroundType
    return v === 'color' || v === 'image' ? v : 'none'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundType = v
    if (v === 'color' && typeof t.pageBackgroundColor !== 'string') t.pageBackgroundColor = '#ffffff'
    if (v !== 'image') delete t.pageBackgroundImageFile
  },
})

const color = computed<string>({
  get() {
    const t = props.target.get()
    return typeof t?.pageBackgroundColor === 'string' ? t.pageBackgroundColor : '#ffffff'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundColor = v
  },
})

const coverSidebar = computed<boolean>({
  get() {
    const t = props.target.get()
    return t?.pageBackgroundCoverSidebar !== false
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundCoverSidebar = v
  },
})

const fit = computed<PageBackgroundImageFit>({
  get() {
    const t = props.target.get()
    const v = t?.pageBackgroundImageFit
    return v === 'contain' || v === 'fill' || v === 'none' ? v : 'cover'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundImageFit = v
  },
})

const blurMode = computed<PageBackgroundBlurMode>({
  get() {
    const t = props.target.get()
    const v = t?.pageBackgroundBlurMode
    return v === 'background' || v === 'glass' ? v : 'none'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundBlurMode = v
    if (v !== 'none' && (typeof t.pageBackgroundBlur !== 'number' || !Number.isFinite(t.pageBackgroundBlur)))
      t.pageBackgroundBlur = 14
  },
})

const blur = computed<number>({
  get() {
    const t = props.target.get()
    const v = Number(t?.pageBackgroundBlur)
    if (!Number.isFinite(v)) return 14
    return Math.min(40, Math.max(0, Math.round(v)))
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundBlur = v
  },
})

const scrimMode = computed<PageBackgroundScrimMode>({
  get() {
    const t = props.target.get()
    const v = t?.pageBackgroundScrimMode
    return v === 'black' || v === 'white' ? v : 'auto'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    if (v === 'auto') delete t.pageBackgroundScrimMode
    else t.pageBackgroundScrimMode = v
  },
})

const scrimStrength = computed<number>({
  get() {
    const t = props.target.get()
    if (!t || !Object.prototype.hasOwnProperty.call(t, 'pageBackgroundScrimStrength'))
      return blurMode.value === 'none' ? 0 : 100
    const v = Number(t?.pageBackgroundScrimStrength)
    if (!Number.isFinite(v)) return blurMode.value === 'none' ? 0 : 100
    return Math.min(100, Math.max(0, Math.round(v)))
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    const next = Math.min(100, Math.max(0, Math.round(Number(v))))
    const defaultValue = blurMode.value === 'none' ? 0 : 100
    if (next === defaultValue) delete t.pageBackgroundScrimStrength
    else t.pageBackgroundScrimStrength = next
  },
})

const imagePath = computed(() => {
  const t = props.target.get()
  const f = t?.pageBackgroundImageFile
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ''
  const path = (f as any).path
  return typeof path === 'string' ? path : ''
})

function clearAll() {
  const t = props.target.ensure()
  if (!t) return
  t.pageBackgroundType = 'none'
  delete t.pageBackgroundImageFile
  delete t.pageBackgroundImageFit
  delete t.pageBackgroundBlurMode
  delete t.pageBackgroundBlur
  delete t.pageBackgroundCoverSidebar
  delete t.pageBackgroundColor
  delete t.pageBackgroundScrimMode
  delete t.pageBackgroundScrimStrength
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <FormField label="背景类型">
      <div class="flex items-center gap-2">
        <ToggleGroup
          type="single"
          size="xs"
          class="flex-1 grid grid-cols-3"
          :model-value="type"
          @update:model-value="
            (v) => {
              if (v === 'none' || v === 'color' || v === 'image') type = v
            }
          "
        >
          <ToggleGroupItem value="none">无背景</ToggleGroupItem>
          <ToggleGroupItem value="color">纯色底</ToggleGroupItem>
          <ToggleGroupItem value="image">图片背景</ToggleGroupItem>
        </ToggleGroup>
        <Button
          size="xs"
          variant="outline"
          :disabled="type === 'none'"
          @click="clearAll"
        >
          清空
        </Button>
      </div>
    </FormField>

    <div
      v-if="type === 'none' && noneHint"
      class="text-xs text-muted-foreground"
    >
      {{ noneHint }}
    </div>

    <FormField
      v-if="type === 'color'"
      label="背景颜色"
    >
      <ColorPicker v-model="color" />
    </FormField>

    <div
      v-else-if="type === 'image'"
      class="flex flex-col gap-3"
    >
      <FormField label="背景图片">
        <div
          v-if="!imagePath"
          class="flex-col-center p-4 border border-dashed border-border rounded-lg bg-muted cursor-pointer transition-colors duration-150 w-full box-border hover:border-primary hover:bg-popover"
          @click="props.target.uploadImage?.()"
        >
          <ImageIcon class="size-6 text-muted-foreground mb-1" />
          <div class="text-xs font-medium">点击上传背景图</div>
          <div class="text-[11px] text-muted-foreground">支持 PNG, JPG, WebP 格式</div>
        </div>
        <div
          v-else
          class="flex items-center gap-2.5 py-2 px-2.5 border border-border rounded-lg bg-muted w-full box-border"
        >
          <ImagePreview
            :src="imagePath"
            alt="背景预览"
            class="size-10 rounded-md border-border shrink-0"
          />
          <div class="flex flex-col flex-1 min-w-0 gap-0.5">
            <span class="text-[13px] font-medium text-foreground">已上传背景图</span>
            <span class="text-[11px] text-muted-foreground">已设置生效</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              @click="props.target.uploadImage?.()"
            >
              更换
            </Button>
            <Button
              size="icon-xs"
              variant="destructive"
              aria-label="清除背景图"
              @click="props.target.clearImage?.()"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>
      </FormField>

      <FormField label="图片填充方式">
        <Select v-model="fit">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="填充方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">铺满裁剪 (cover)</SelectItem>
            <SelectItem value="contain">完整显示 (contain)</SelectItem>
            <SelectItem value="fill">拉伸填满 (fill)</SelectItem>
            <SelectItem value="none">原始大小 (none)</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </div>

    <template v-if="type !== 'none'">
      <SettingRow
        title="延伸覆盖侧边导航栏"
        hint="开启后背景将延伸覆盖左侧导航区域"
        variant="none"
        class="py-1"
      >
        <Switch
          :checked="coverSidebar"
          @update:checked="coverSidebar = $event"
        />
      </SettingRow>

      <FormField
        label="遮罩色调与透明度"
        class="gap-2 pt-2 border-t border-border"
      >
        <ToggleGroup
          type="single"
          :model-value="scrimMode"
          class="w-full grid grid-cols-3"
          @update:model-value="(val) => val && (scrimMode = val as any)"
        >
          <ToggleGroupItem value="auto">自适应</ToggleGroupItem>
          <ToggleGroupItem value="black">暗黑遮罩</ToggleGroupItem>
          <ToggleGroupItem value="white">纯白遮罩</ToggleGroupItem>
        </ToggleGroup>
        <div class="flex items-center gap-3">
          <Slider
            :model-value="[scrimStrength]"
            :min="0"
            :max="100"
            :step="1"
            class="flex-1"
            @update:model-value="scrimStrength = $event?.[0] ?? 0"
          />
          <NumberField
            v-model="scrimStrength"
            :min="0"
            :max="100"
            size="xs"
            class="w-20"
          />
        </div>
      </FormField>

      <FormField
        label="视觉滤镜与模糊"
        class="gap-2 pt-2 border-t border-border"
      >
        <ToggleGroup
          type="single"
          :model-value="blurMode"
          class="w-full grid grid-cols-3"
          @update:model-value="(val) => val && (blurMode = val as any)"
        >
          <ToggleGroupItem value="none">清晰无滤镜</ToggleGroupItem>
          <ToggleGroupItem value="background">模糊背景</ToggleGroupItem>
          <ToggleGroupItem value="glass">磨砂玻璃</ToggleGroupItem>
        </ToggleGroup>
        <div
          v-if="blurMode !== 'none'"
          class="flex items-center gap-3"
        >
          <Slider
            :model-value="[blur]"
            :min="0"
            :max="40"
            :step="1"
            class="flex-1"
            @update:model-value="blur = $event?.[0] ?? 0"
          />
          <NumberField
            v-model="blur"
            :min="0"
            :max="40"
            size="xs"
            class="w-20"
          />
        </div>
      </FormField>
    </template>
  </div>
</template>
