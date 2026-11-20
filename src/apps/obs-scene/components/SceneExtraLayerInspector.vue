<script setup lang="ts">
import { Plus, Trash2, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { uploadObsSceneAsset } from '@/api/obs-scene'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { SmartImage } from '@/shared/ui/image'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { MarqueeImageItem, MarqueeLayer, SlideshowLayer } from '../types'
import { createShortId } from '../types'

const props = defineProps<{
  layer: MarqueeLayer | SlideshowLayer
}>()

const store = useObsSceneEditorStore()
const uploadingMulti = ref(false)
const multiFileInputRef = ref<HTMLInputElement | null>(null)
const newImageUrl = ref('')

const DEFAULT_SCENE_FONT_FAMILY = 'system-ui, -apple-system, sans-serif'

const marqueeLayer = computed(() => (props.layer.type === 'marquee' ? props.layer : null))
const slideshowLayer = computed(() => (props.layer.type === 'slideshow' ? props.layer : null))

const marqueeFontValue = computed(() => {
  const value = marqueeLayer.value?.marquee.fontFamily?.trim()
  return !value || value === DEFAULT_SCENE_FONT_FAMILY ? null : value
})

function updateMarqueeFont(value: string | null) {
  if (!marqueeLayer.value) return
  marqueeLayer.value.marquee.fontFamily = value || DEFAULT_SCENE_FONT_FAMILY
  store.pushHistory()
}

const marqueeTextValue = computed({
  get: () => marqueeLayer.value?.marquee.items.join('\n') ?? '',
  set: (val: string) => {
    if (!marqueeLayer.value) return
    marqueeLayer.value.marquee.items = val.split('\n')
  },
})

const activeImageList = computed<MarqueeImageItem[]>(() => {
  if (marqueeLayer.value) return marqueeLayer.value.marquee.images
  if (slideshowLayer.value) return slideshowLayer.value.slideshow.images
  return []
})

function triggerMultiImageUpload() {
  multiFileInputRef.value?.click()
}

async function handleMultiImageUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length === 0) return

  uploadingMulti.value = true
  let uploadedCount = 0
  try {
    for (const file of files) {
      const asset = await uploadObsSceneAsset(file)
      const item: MarqueeImageItem = {
        id: createShortId('mi'),
        url: asset.url,
        label: file.name,
      }
      if (marqueeLayer.value) marqueeLayer.value.marquee.images.push(item)
      else if (slideshowLayer.value) slideshowLayer.value.slideshow.images.push(item)
      uploadedCount++
    }
    if (uploadedCount > 0) {
      store.pushHistory()
      toast.success(`已上传 ${uploadedCount} 张图片`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '上传图片失败')
  } finally {
    uploadingMulti.value = false
  }
}

function addImageByUrl() {
  const url = newImageUrl.value.trim()
  if (!url) return
  const item: MarqueeImageItem = {
    id: createShortId('mi'),
    url,
  }
  if (marqueeLayer.value) marqueeLayer.value.marquee.images.push(item)
  else if (slideshowLayer.value) slideshowLayer.value.slideshow.images.push(item)
  newImageUrl.value = ''
  store.pushHistory()
}

function removeImageItem(id: string) {
  if (marqueeLayer.value) {
    marqueeLayer.value.marquee.images = marqueeLayer.value.marquee.images.filter((i) => i.id !== id)
    store.pushHistory()
  } else if (slideshowLayer.value) {
    slideshowLayer.value.slideshow.images = slideshowLayer.value.slideshow.images.filter((i) => i.id !== id)
    store.pushHistory()
  }
}
</script>

<template>
  <!-- 走马灯属性（文字 / 图片双模式） -->
  <section
    v-if="marqueeLayer"
    class="space-y-3"
  >
    <div class="text-xs font-semibold text-foreground">走马灯设置</div>

    <FormField label="内容类型">
      <ToggleGroup
        type="single"
        class="w-full grid grid-cols-2"
        :model-value="marqueeLayer.marquee.mode"
        @update:model-value="
          (v) => {
            if (v && marqueeLayer) {
              marqueeLayer.marquee.mode = v as 'text' | 'image'
              store.pushHistory()
            }
          }
        "
      >
        <ToggleGroupItem value="text">文字走马灯</ToggleGroupItem>
        <ToggleGroupItem value="image">图片走马灯</ToggleGroupItem>
      </ToggleGroup>
    </FormField>

    <div class="grid grid-cols-2 gap-2">
      <FormField
        label="滚动方向"
        class="min-w-0"
      >
        <Select
          :model-value="marqueeLayer.marquee.direction"
          @update:model-value="
            (v) => {
              if (marqueeLayer) {
                marqueeLayer.marquee.direction = String(v) as 'left' | 'right' | 'up' | 'down'
                store.pushHistory()
              }
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">向左</SelectItem>
            <SelectItem value="right">向右</SelectItem>
            <SelectItem value="up">向上</SelectItem>
            <SelectItem value="down">向下</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        label="速度 (px/s)"
        class="min-w-0"
      >
        <NumberField
          :model-value="marqueeLayer.marquee.speed"
          :min="10"
          :max="600"
          @update:model-value="
            (v) => {
              if (v && marqueeLayer) {
                marqueeLayer.marquee.speed = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>
      <FormField
        label="项间距 (px)"
        class="min-w-0"
      >
        <NumberField
          :model-value="marqueeLayer.marquee.gap"
          :min="8"
          :max="300"
          @update:model-value="
            (v) => {
              if (v !== undefined && marqueeLayer) {
                marqueeLayer.marquee.gap = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>
      <FormField
        label="内边距 (px)"
        class="min-w-0"
      >
        <NumberField
          :model-value="marqueeLayer.marquee.padding"
          :min="0"
          :max="80"
          @update:model-value="
            (v) => {
              if (v !== undefined && marqueeLayer) {
                marqueeLayer.marquee.padding = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>
    </div>

    <!-- 文字走马灯专属 -->
    <template v-if="marqueeLayer.marquee.mode === 'text'">
      <FormField label="滚动文案（每行一条）">
        <Textarea
          v-model="marqueeTextValue"
          rows="4"
          placeholder="每行输入一条公告文案..."
          @blur="store.pushHistory()"
        />
      </FormField>
      <FormField label="字体">
        <GoogleFontPicker
          :model-value="marqueeFontValue"
          :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
          :show-preview="false"
          @update:model-value="updateMarqueeFont"
        />
      </FormField>
      <div class="grid grid-cols-2 gap-2">
        <FormField
          label="分隔符"
          class="min-w-0"
        >
          <Input
            :model-value="marqueeLayer.marquee.separator"
            placeholder="✦"
            @update:model-value="
              (v) => {
                if (marqueeLayer) marqueeLayer.marquee.separator = String(v)
              }
            "
            @blur="store.pushHistory()"
          />
        </FormField>
        <FormField
          label="字号 (px)"
          class="min-w-0"
        >
          <NumberField
            :model-value="marqueeLayer.marquee.fontSize"
            :min="12"
            :max="180"
            @update:model-value="
              (v) => {
                if (v && marqueeLayer) {
                  marqueeLayer.marquee.fontSize = v
                  store.pushHistory()
                }
              }
            "
          />
        </FormField>
        <FormField
          label="文字颜色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="marqueeLayer.marquee.color"
            @update:model-value="
              (v) => {
                if (marqueeLayer) {
                  marqueeLayer.marquee.color = v
                  store.pushHistory()
                }
              }
            "
          />
        </FormField>
        <FormField
          label="背景底色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="marqueeLayer.marquee.backgroundColor"
            @update:model-value="
              (v) => {
                if (marqueeLayer) {
                  marqueeLayer.marquee.backgroundColor = v
                  store.pushHistory()
                }
              }
            "
          />
        </FormField>
      </div>
    </template>

    <!-- 图片走马灯专属 -->
    <template v-else>
      <FormField label="背景底色">
        <ColorPicker
          :model-value="marqueeLayer.marquee.backgroundColor"
          @update:model-value="
            (v) => {
              if (marqueeLayer) {
                marqueeLayer.marquee.backgroundColor = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>
      <div class="grid grid-cols-2 gap-2">
        <FormField
          label="图片高度 (px)"
          class="min-w-0"
        >
          <NumberField
            :model-value="marqueeLayer.marquee.imageHeight"
            :min="24"
            :max="600"
            @update:model-value="
              (v) => {
                if (v && marqueeLayer) {
                  marqueeLayer.marquee.imageHeight = v
                  store.pushHistory()
                }
              }
            "
          />
        </FormField>
        <FormField
          label="图片圆角 (px)"
          class="min-w-0"
        >
          <NumberField
            :model-value="marqueeLayer.marquee.imageRadius"
            :min="0"
            :max="200"
            @update:model-value="
              (v) => {
                if (v !== undefined && marqueeLayer) {
                  marqueeLayer.marquee.imageRadius = v
                  store.pushHistory()
                }
              }
            "
          />
        </FormField>
      </div>

      <input
        ref="multiFileInputRef"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp"
        class="hidden"
        @change="handleMultiImageUpload"
      />
      <Button
        class="w-full"
        variant="secondary"
        :disabled="uploadingMulti"
        @click="triggerMultiImageUpload"
      >
        <Upload class="w-3.5 h-3.5" />
        <span>{{ uploadingMulti ? '上传转码中...' : '批量上传本地图片' }}</span>
      </Button>

      <div class="flex items-center gap-1.5">
        <Input
          v-model="newImageUrl"
          placeholder="粘贴图片直链 URL..."
          @keydown.enter="addImageByUrl"
        />
        <Button
          variant="outline"
          size="icon-sm"
          class="shrink-0"
          title="添加图片"
          @click="addImageByUrl"
        >
          <Plus class="w-3.5 h-3.5" />
        </Button>
      </div>

      <div
        v-if="activeImageList.length > 0"
        class="space-y-1.5 max-h-44 overflow-y-auto scrollbar-thin"
      >
        <div
          v-for="img in activeImageList"
          :key="img.id"
          class="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1"
        >
          <SmartImage
            :src="img.url"
            alt=""
            class="w-8 h-8 rounded object-cover shrink-0 bg-black/20"
          />
          <span class="flex-1 min-w-0 truncate text-[11px] text-muted-foreground">{{ img.label || img.url }}</span>
          <Button
            variant="ghost"
            size="none"
            class="w-5 h-5 flex-center shrink-0 [&_svg]:size-3"
            @click="removeImageItem(img.id)"
          >
            <Trash2 class="text-destructive" />
          </Button>
        </div>
      </div>
    </template>
  </section>

  <!-- 图片轮播属性 -->
  <section
    v-else-if="slideshowLayer"
    class="space-y-3"
  >
    <div class="text-xs font-semibold text-foreground">图片轮播设置</div>

    <div class="grid grid-cols-2 gap-2">
      <FormField
        label="切换间隔 (秒)"
        class="min-w-0"
      >
        <NumberField
          :model-value="slideshowLayer.slideshow.intervalSec"
          :min="1"
          :max="120"
          @update:model-value="
            (v) => {
              if (v && slideshowLayer) {
                slideshowLayer.slideshow.intervalSec = v
                store.pushHistory()
              }
            }
          "
        />
      </FormField>
      <FormField
        label="过渡动画"
        class="min-w-0"
      >
        <Select
          :model-value="slideshowLayer.slideshow.transition"
          @update:model-value="
            (v) => {
              if (slideshowLayer) {
                slideshowLayer.slideshow.transition = String(v) as 'fade' | 'slide' | 'none'
                store.pushHistory()
              }
            }
          "
        >
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fade">淡入淡出</SelectItem>
            <SelectItem value="slide">平滑滑动</SelectItem>
            <SelectItem value="none">瞬切</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </div>

    <FormField label="填充模式">
      <Select
        :model-value="slideshowLayer.slideshow.objectFit"
        @update:model-value="
          (v) => {
            if (slideshowLayer) {
              slideshowLayer.slideshow.objectFit = String(v) as 'contain' | 'cover'
              store.pushHistory()
            }
          }
        "
      >
        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="cover">裁切铺满 (Cover)</SelectItem>
          <SelectItem value="contain">完整适应 (Contain)</SelectItem>
        </SelectContent>
      </Select>
    </FormField>

    <SettingRow
      variant="none"
      title="显示底部指示点"
    >
      <Switch
        :model-value="slideshowLayer.slideshow.showDots"
        @update:model-value="
          (v) => {
            if (slideshowLayer) {
              slideshowLayer.slideshow.showDots = v
              store.pushHistory()
            }
          }
        "
      />
    </SettingRow>

    <input
      ref="multiFileInputRef"
      type="file"
      multiple
      accept="image/png,image/jpeg,image/gif,image/webp"
      class="hidden"
      @change="handleMultiImageUpload"
    />
    <Button
      class="w-full"
      variant="secondary"
      :disabled="uploadingMulti"
      @click="triggerMultiImageUpload"
    >
      <Upload class="w-3.5 h-3.5" />
      <span>{{ uploadingMulti ? '上传转码中...' : '批量上传轮播图片' }}</span>
    </Button>

    <div class="flex items-center gap-1.5">
      <Input
        v-model="newImageUrl"
        placeholder="粘贴图片直链 URL..."
        @keydown.enter="addImageByUrl"
      />
      <Button
        variant="outline"
        size="icon-sm"
        class="shrink-0"
        title="添加图片"
        @click="addImageByUrl"
      >
        <Plus class="w-3.5 h-3.5" />
      </Button>
    </div>

    <div
      v-if="activeImageList.length > 0"
      class="space-y-1.5 max-h-44 overflow-y-auto scrollbar-thin"
    >
      <div
        v-for="img in activeImageList"
        :key="img.id"
        class="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1"
      >
        <SmartImage
          :src="img.url"
          alt=""
          class="w-8 h-8 rounded object-cover shrink-0 bg-black/20"
        />
        <span class="flex-1 min-w-0 truncate text-[11px] text-muted-foreground">{{ img.label || img.url }}</span>
        <Button
          variant="ghost"
          size="none"
          class="w-5 h-5 flex-center shrink-0 [&_svg]:size-3"
          @click="removeImageItem(img.id)"
        >
          <Trash2 class="text-destructive" />
        </Button>
      </div>
    </div>
  </section>
</template>
