<script setup lang="ts">
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
  <div class="builder-form">
    <UFormField label="背景类型">
      <div
        class="builder-row"
        style="gap: 10px"
      >
        <URadioGroup
          v-model="type"
          :items="[
            { label: '无', value: 'none' },
            { label: '纯色', value: 'color' },
            { label: '图片', value: 'image' },
          ]"
          orientation="horizontal"
        />
        <UButton
          size="sm"
          variant="soft"
          @click="clearAll"
        >
          清空
        </UButton>
      </div>
    </UFormField>

    <Transition
      name="fade-slide"
      mode="out-in"
    >
      <div :key="type">
        <template v-if="type === 'color'">
          <UFormField label="背景颜色">
            <UColorPicker
              v-model="color"
              :modes="['hex']"
              :show-alpha="true"
            />
          </UFormField>
        </template>

        <template v-else-if="type === 'image'">
          <UFormField label="背景图片">
            <div class="builder-row">
              <UButton
                v-if="props.target.uploadImage"
                size="sm"
                @click="props.target.uploadImage"
              >
                上传背景图
              </UButton>
              <UButton
                v-if="props.target.clearImage"
                size="sm"
                variant="soft"
                :disabled="!imagePath"
                @click="props.target.clearImage"
              >
                清除
              </UButton>
              <Transition name="fade-scale">
                <img
                  v-if="imagePath"
                  :src="imagePath"
                  alt=""
                  referrerpolicy="no-referrer"
                  style="
                    width: 36px;
                    height: 36px;
                    object-fit: cover;
                    border-radius: 6px;
                    border: 1px solid var(--vtsuru-border);
                  "
                />
              </Transition>
            </div>
          </UFormField>
          <UFormField label="图片填充方式">
            <USelect
              v-model="fit"
              :items="[
                { label: '铺满', value: 'cover' },
                { label: '完整显示', value: 'contain' },
                { label: '拉伸填满', value: 'fill' },
                { label: '原始大小', value: 'none' },
              ]"
            />
          </UFormField>
          <Transition name="fade">
            <UAlert
              v-if="!imagePath"
              type="warning"
              :show-icon="true"
              style="margin-bottom: 12px"
            >
              请选择并上传一张图片作为背景。
            </UAlert>
          </Transition>
        </template>
      </div>
    </Transition>

    <template v-if="type !== 'none'">
      <div
        class="builder-row"
        style="margin-bottom: 10px"
      >
        <div
          style="font-size: 12px; color: var(--vtsuru-fg-muted)"
          title="建议开启以让内置页面也生效"
        >
          覆盖导航区域
        </div>
        <USwitch
          v-model="coverSidebar"
          size="small"
        />
      </div>

      <UFormField label="遮罩颜色">
        <URadioGroup
          v-model="scrimMode"
          :items="[
            { label: '自动', value: 'auto' },
            { label: '黑', value: 'black' },
            { label: '白', value: 'white' },
          ]"
          orientation="horizontal"
        />
      </UFormField>

      <UFormField
        label="遮罩强度 %"
        :show-feedback="false"
      >
        <UInputNumber
          v-model="scrimStrength"
          :min="0"
          :max="100"
          style="width: 100%"
        />
      </UFormField>

      <UFormField label="背景效果">
        <URadioGroup
          v-model="blurMode"
          :items="[
            { label: '无', value: 'none' },
            { label: '模糊背景', value: 'background' },
            { label: '磨砂玻璃', value: 'glass' },
          ]"
          orientation="horizontal"
        />
      </UFormField>

      <UFormField
        label="强度 px"
        :show-feedback="false"
      >
        <UInputNumber
          v-model="blur"
          :min="0"
          :max="40"
          style="width: 100%"
          :disabled="blurMode === 'none'"
        />
      </UFormField>
    </template>
  </div>
</template>

<style scoped src="./ui-transitions.css"></style>
