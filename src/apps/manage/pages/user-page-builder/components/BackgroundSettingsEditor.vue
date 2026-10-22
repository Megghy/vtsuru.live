<script setup lang="ts">
import { ImageOutline, TrashOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { NInputNumber } from '@/shared/ui/NInputNumber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'

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
    if (v === 'color' && typeof t.pageBackgroundColor !== 'string') t.pageBackgroundColor = 'rgba(255, 255, 255, 1)'
    if (v !== 'image') delete t.pageBackgroundImageFile
  },
})

const color = computed<string>({
  get() {
    const t = props.target.get()
    return typeof t?.pageBackgroundColor === 'string' ? t.pageBackgroundColor : 'rgba(255, 255, 255, 1)'
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
    <div class="flex flex-col gap-1.5">
      <label class="text-xs text-muted-foreground font-medium">背景类型</label>
      <div class="flex items-center gap-2">
        <div class="grid grid-cols-3 gap-1 bg-muted p-0.5 rounded-lg flex-1">
          <Button :variant="type === 'none' ? 'default' : 'ghost'" @click="type = 'none'">
            无背景
          </Button>
          <Button :variant="type === 'color' ? 'default' : 'ghost'" @click="type = 'color'">
            纯色底
          </Button>
          <Button :variant="type === 'image' ? 'default' : 'ghost'" @click="type = 'image'">
            图片背景
          </Button>
        </div>
        <Button variant="outline" class="px-2" :disabled="type === 'none'" @click="clearAll">
          清空
        </Button>
      </div>
    </div>

    <div
      v-if="type === 'none' && noneHint"
      class="text-xs text-muted-foreground"
    >
      {{ noneHint }}
    </div>

    <div v-if="type === 'color'" class="flex flex-col gap-1.5">
      <label class="text-xs text-muted-foreground">背景颜色</label>
      <ColorPicker v-model="color" />
    </div>

    <div v-else-if="type === 'image'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground">背景图片</label>
        <div
          v-if="!imagePath"
          class="upload-dropzone"
          @click="props.target.uploadImage?.()"
        >
          <component :is="ImageOutline" class="size-6 text-muted-foreground mb-1" />
          <div class="text-xs font-medium">点击上传背景图</div>
          <div class="text-[11px] text-muted-foreground">支持 PNG, JPG, WebP 格式</div>
        </div>
        <div
          v-else
          class="image-preview-bar"
        >
          <img
            :src="imagePath"
            alt="背景预览"
            referrerpolicy="no-referrer"
            class="image-thumb"
          />
          <div class="image-info">
            <span class="image-filename">已上传背景图</span>
            <span class="image-sub">已设置生效</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Button size="xs" variant="outline" class="px-2" @click="props.target.uploadImage?.()">
              更换
            </Button>
            <Button size="xs" variant="destructive" class="px-2" @click="props.target.clearImage?.()">
              <component :is="TrashOutline" class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">图片填充方式</label>
        <Select v-model="fit">
          <SelectTrigger>
            <SelectValue placeholder="填充方式" />
          </SelectTrigger>
          <SelectContent class="text-xs">
            <SelectItem value="cover">铺满裁剪 (cover)</SelectItem>
            <SelectItem value="contain">完整显示 (contain)</SelectItem>
            <SelectItem value="fill">拉伸填满 (fill)</SelectItem>
            <SelectItem value="none">原始大小 (none)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <template v-if="type !== 'none'">
      <div class="flex items-center justify-between py-1">
        <span
          class="text-xs text-foreground cursor-help"
          title="开启后背景将延伸覆盖左侧导航区域"
        >
          延伸覆盖侧边导航栏
        </span>
        <Switch :checked="coverSidebar" @update:checked="coverSidebar = $event" />
      </div>

      <div class="flex flex-col gap-2 pt-2 border-t border-border">
        <label class="text-xs text-muted-foreground font-medium">遮罩色调与透明度</label>
        <div class="grid grid-cols-3 gap-1 bg-muted p-0.5 rounded-lg w-full">
          <Button :variant="scrimMode === 'auto' ? 'default' : 'ghost'" @click="scrimMode = 'auto'">
            自适应
          </Button>
          <Button :variant="scrimMode === 'black' ? 'default' : 'ghost'" @click="scrimMode = 'black'">
            暗黑遮罩
          </Button>
          <Button :variant="scrimMode === 'white' ? 'default' : 'ghost'" @click="scrimMode = 'white'">
            纯白遮罩
          </Button>
        </div>
        <div class="flex items-center gap-3">
          <Slider
            :model-value="[scrimStrength]"
            :min="0"
            :max="100"
            :step="1"
            class="flex-1"
            @update:model-value="scrimStrength = $event?.[0] ?? 0"
          />
          <NInputNumber
            v-model="scrimStrength"
            :min="0"
            :max="100"
            size="tiny"
            class="w-20"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2 pt-2 border-t border-border">
        <label class="text-xs text-muted-foreground font-medium">视觉滤镜与模糊</label>
        <div class="grid grid-cols-3 gap-1 bg-muted p-0.5 rounded-lg w-full">
          <Button :variant="blurMode === 'none' ? 'default' : 'ghost'" @click="blurMode = 'none'">
            清晰无滤镜
          </Button>
          <Button :variant="blurMode === 'background' ? 'default' : 'ghost'" @click="blurMode = 'background'">
            模糊背景
          </Button>
          <Button :variant="blurMode === 'glass' ? 'default' : 'ghost'" @click="blurMode = 'glass'">
            磨砂玻璃
          </Button>
        </div>
        <div v-if="blurMode !== 'none'" class="flex items-center gap-3">
          <Slider
            :model-value="[blur]"
            :min="0"
            :max="40"
            :step="1"
            class="flex-1"
            @update:model-value="blur = $event?.[0] ?? 0"
          />
          <NInputNumber
            v-model="blur"
            :min="0"
            :max="40"
            size="tiny"
            class="w-20"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@import './ui-transitions.css';

.upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
}

.upload-dropzone:hover {
  border-color: var(--primary, #3b82f6);
  background: var(--popover);
}

.image-preview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
  width: 100%;
  box-sizing: border-box;
}

.image-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.image-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.image-filename {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
}

.image-sub {
  font-size: 11px;
  color: var(--muted-foreground);
}
</style>
