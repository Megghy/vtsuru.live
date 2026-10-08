<script setup lang="ts">
import { ImageOutline, TrashOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NColorPicker,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
  NText,
} from 'naive-ui'
import { computed } from 'vue'

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
  <NForm
    label-placement="top"
    size="small"
  >
    <NFormItem label="背景类型">
      <NFlex
        justify="space-between"
        align="center"
        :wrap="false"
        style="gap: 10px; width: 100%"
      >
        <NRadioGroup
          v-model:value="type"
          size="small"
          style="flex: 1"
        >
          <NRadioButton
            value="none"
            style="width: 33.3%; text-align: center"
          >
            无背景
          </NRadioButton>
          <NRadioButton
            value="color"
            style="width: 33.3%; text-align: center"
          >
            纯色底
          </NRadioButton>
          <NRadioButton
            value="image"
            style="width: 33.4%; text-align: center"
          >
            图片背景
          </NRadioButton>
        </NRadioGroup>
        <NButton
          size="small"
          secondary
          :disabled="type === 'none'"
          @click="clearAll"
        >
          清空
        </NButton>
      </NFlex>
    </NFormItem>

    <div
      v-if="type === 'none' && noneHint"
      style="margin-bottom: 10px; font-size: 12px; color: var(--vtsuru-fg-muted)"
    >
      {{ noneHint }}
    </div>

    <Transition
      name="fade-slide"
      mode="out-in"
    >
      <div :key="type">
        <template v-if="type === 'color'">
          <NFormItem label="背景颜色">
            <NColorPicker
              v-model:value="color"
              :modes="['hex']"
              :show-alpha="true"
            />
          </NFormItem>
        </template>

        <template v-else-if="type === 'image'">
          <NFormItem label="背景图片">
            <div
              v-if="!imagePath"
              class="upload-dropzone"
              @click="props.target.uploadImage?.()"
            >
              <NIcon
                size="24"
                :component="ImageOutline"
                style="color: var(--vtsuru-fg-muted); margin-bottom: 4px"
              />
              <div style="font-size: 13px; font-weight: 500">点击上传背景图</div>
              <div style="font-size: 11px; color: var(--vtsuru-fg-muted)">支持 PNG, JPG, WebP 格式</div>
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
              <NFlex :size="6">
                <NButton
                  size="tiny"
                  secondary
                  @click="props.target.uploadImage?.()"
                >
                  更换
                </NButton>
                <NButton
                  size="tiny"
                  type="error"
                  secondary
                  @click="props.target.clearImage?.()"
                >
                  <template #icon>
                    <NIcon :component="TrashOutline" />
                  </template>
                </NButton>
              </NFlex>
            </div>
          </NFormItem>
          <NFormItem label="图片填充方式">
            <NSelect
              v-model:value="fit"
              :options="[
                { label: '铺满裁剪 (cover)', value: 'cover' },
                { label: '完整显示 (contain)', value: 'contain' },
                { label: '拉伸填满 (fill)', value: 'fill' },
                { label: '原始大小 (none)', value: 'none' },
              ]"
            />
          </NFormItem>
        </template>
      </div>
    </Transition>

    <template v-if="type !== 'none'">
      <NFlex
        justify="space-between"
        align="center"
        :wrap="false"
        style="margin-bottom: 12px; margin-top: 4px"
      >
        <div
          style="font-size: 13px; color: var(--vtsuru-fg)"
          title="开启后背景将延伸覆盖左侧导航区域"
        >
          延伸覆盖侧边导航栏
        </div>
        <NSwitch
          v-model:value="coverSidebar"
          size="small"
        />
      </NFlex>

      <NFormItem label="遮罩色调与透明度">
        <NFlex
          vertical
          :size="8"
          style="width: 100%"
        >
          <NRadioGroup
            v-model:value="scrimMode"
            size="small"
            style="width: 100%"
          >
            <NRadioButton
              value="auto"
              style="width: 33.3%; text-align: center"
            >
              自适应
            </NRadioButton>
            <NRadioButton
              value="black"
              style="width: 33.3%; text-align: center"
            >
              暗黑遮罩
            </NRadioButton>
            <NRadioButton
              value="white"
              style="width: 33.4%; text-align: center"
            >
              纯白遮罩
            </NRadioButton>
          </NRadioGroup>
          <NFlex
            align="center"
            :size="10"
            style="width: 100%"
          >
            <NSlider
              v-model:value="scrimStrength"
              :min="0"
              :max="100"
              :step="1"
              style="flex: 1"
            />
            <NInputNumber
              v-model:value="scrimStrength"
              :min="0"
              :max="100"
              size="small"
              style="width: 80px"
            >
              <template #suffix> % </template>
            </NInputNumber>
          </NFlex>
        </NFlex>
      </NFormItem>

      <NFormItem label="视觉滤镜与模糊">
        <NFlex
          vertical
          :size="8"
          style="width: 100%"
        >
          <NRadioGroup
            v-model:value="blurMode"
            size="small"
            style="width: 100%"
          >
            <NRadioButton
              value="none"
              style="width: 33.3%; text-align: center"
            >
              清晰无滤镜
            </NRadioButton>
            <NRadioButton
              value="background"
              style="width: 33.3%; text-align: center"
            >
              模糊背景
            </NRadioButton>
            <NRadioButton
              value="glass"
              style="width: 33.4%; text-align: center"
            >
              磨砂玻璃
            </NRadioButton>
          </NRadioGroup>
          <NFlex
            v-if="blurMode !== 'none'"
            align="center"
            :size="10"
            style="width: 100%"
          >
            <NSlider
              v-model:value="blur"
              :min="0"
              :max="40"
              :step="1"
              style="flex: 1"
            />
            <NInputNumber
              v-model:value="blur"
              :min="0"
              :max="40"
              size="small"
              style="width: 80px"
            >
              <template #suffix> px </template>
            </NInputNumber>
          </NFlex>
        </NFlex>
      </NFormItem>
    </template>
  </NForm>
</template>

<style scoped>
@import './ui-transitions.css';

.upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
}

.upload-dropzone:hover {
  border-color: var(--vtsuru-primary, #3b82f6);
  background: var(--vtsuru-bg-elevated);
}

.image-preview-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
  width: 100%;
  box-sizing: border-box;
}

.image-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--vtsuru-border);
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
  color: var(--vtsuru-fg);
}

.image-sub {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}
</style>
