<script setup lang="ts">
import { NAlert, NButton, NColorPicker, NFlex, NForm, NFormItem, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSwitch } from 'naive-ui';
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
    return (v === 'color' || v === 'image') ? v : 'none'
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
    return (v === 'contain' || v === 'fill' || v === 'none') ? v : 'cover'
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
    return (v === 'background' || v === 'glass') ? v : 'none'
  },
  set(v) {
    const t = props.target.ensure()
    if (!t) return
    t.pageBackgroundBlurMode = v
    if (v !== 'none' && (typeof t.pageBackgroundBlur !== 'number' || !Number.isFinite(t.pageBackgroundBlur))) t.pageBackgroundBlur = 14
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
    return (v === 'black' || v === 'white') ? v : 'auto'
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
    if (!t || !Object.prototype.hasOwnProperty.call(t, 'pageBackgroundScrimStrength')) return blurMode.value === 'none' ? 0 : 100
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
  <NForm label-placement="top" size="small">
    <NFormItem label="背景类型">
      <NFlex justify="space-between" align="center" :wrap="false" style="gap: 10px">
        <NRadioGroup v-model:value="type" size="small" style="flex: 1">
          <NRadioButton value="none" style="width: 33.3%; text-align: center">
            无
          </NRadioButton>
          <NRadioButton value="color" style="width: 33.3%; text-align: center">
            纯色
          </NRadioButton>
          <NRadioButton value="image" style="width: 33.4%; text-align: center">
            图片
          </NRadioButton>
        </NRadioGroup>
        <NButton size="small" secondary @click="clearAll">
          清空
        </NButton>
      </NFlex>
    </NFormItem>

    <Transition name="fade-slide" mode="out-in">
      <div :key="type">
        <template v-if="type === 'color'">
          <NFormItem label="背景颜色">
            <NColorPicker v-model:value="color" :modes="['rgb', 'hex']" :show-alpha="true" />
          </NFormItem>
        </template>

        <template v-else-if="type === 'image'">
          <NFormItem label="背景图片">
            <NFlex align="center">
              <NButton
                v-if="props.target.uploadImage"
                size="small"
                @click="props.target.uploadImage"
              >
                上传背景图
              </NButton>
              <NButton
                v-if="props.target.clearImage"
                size="small"
                secondary
                :disabled="!imagePath"
                @click="props.target.clearImage"
              >
                清除
              </NButton>
              <Transition name="fade-scale">
                <img
                  v-if="imagePath"
                  :src="imagePath"
                  alt=""
                  referrerpolicy="no-referrer"
                  style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--n-border-color);"
                >
              </Transition>
            </NFlex>
          </NFormItem>
          <NFormItem label="图片填充方式">
            <NSelect
              v-model:value="fit"
              :options="[
                { label: '铺满', value: 'cover' },
                { label: '完整显示', value: 'contain' },
                { label: '拉伸填满', value: 'fill' },
                { label: '原始大小', value: 'none' },
              ]"
            />
          </NFormItem>
          <Transition name="fade">
            <NAlert v-if="!imagePath" type="warning" :show-icon="true" style="margin-bottom: 12px">
              请选择并上传一张图片作为背景。
            </NAlert>
          </Transition>
        </template>
      </div>
    </Transition>

    <template v-if="type !== 'none'">
      <NFlex justify="space-between" align="center" :wrap="false" style="margin-bottom: 10px">
        <div style="font-size: 12px; color: var(--n-text-color-3)" title="建议开启以让内置页面也生效">
          覆盖导航区域
        </div>
        <NSwitch v-model:value="coverSidebar" size="small" />
      </NFlex>

      <NFormItem label="遮罩颜色">
        <NRadioGroup v-model:value="scrimMode" size="small" style="width: 100%">
          <NRadioButton value="auto" style="width: 33.3%; text-align: center">
            自动
          </NRadioButton>
          <NRadioButton value="black" style="width: 33.3%; text-align: center">
            黑
          </NRadioButton>
          <NRadioButton value="white" style="width: 33.4%; text-align: center">
            白
          </NRadioButton>
        </NRadioGroup>
      </NFormItem>

      <NFormItem label="遮罩强度 %" :show-feedback="false">
        <NInputNumber v-model:value="scrimStrength" :min="0" :max="100" style="width: 100%" />
      </NFormItem>

      <NFormItem label="背景效果">
        <NRadioGroup v-model:value="blurMode" size="small" style="width: 100%">
          <NRadioButton value="none" style="width: 33.3%; text-align: center">
            无
          </NRadioButton>
          <NRadioButton value="background" style="width: 33.3%; text-align: center">
            模糊背景
          </NRadioButton>
          <NRadioButton value="glass" style="width: 33.4%; text-align: center">
            磨砂玻璃
          </NRadioButton>
        </NRadioGroup>
      </NFormItem>

      <NFormItem label="强度 px" :show-feedback="false">
        <NInputNumber v-model:value="blur" :min="0" :max="40" style="width: 100%" :disabled="blurMode === 'none'" />
      </NFormItem>
    </template>
  </NForm>
</template>

<style scoped src="./ui-transitions.css"></style>
