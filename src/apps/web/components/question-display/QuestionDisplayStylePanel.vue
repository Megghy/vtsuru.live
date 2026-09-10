<script setup lang="ts">
import { ArrowReset24Regular, Checkmark16Regular } from '@vicons/fluent'
import {
  NButton,
  NColorPicker,
  NFormItem,
  NIcon,
  NInputNumber,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
} from 'naive-ui'
import { computed } from 'vue'

import type { Setting_QuestionDisplay } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
  QuestionDisplayVerticalAlign,
} from '@/api/api-models'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import {
  createDefaultQuestionDisplaySetting,
  QUESTION_DISPLAY_PRESETS,
  type QuestionDisplayVisualPreset,
  SYSTEM_CHINESE_FONT_OPTIONS,
} from '@/shared/questionDisplayPresets'

const setting = defineModel<Setting_QuestionDisplay>({ required: true })

const contentFont = computed<string | null>({
  get: () => setting.value.font ?? null,
  set(value) {
    setting.value.font = value ?? undefined
  },
})
const nameFont = computed<string | null>({
  get: () => setting.value.nameFont ?? null,
  set(value) {
    setting.value.nameFont = value || 'Microsoft YaHei'
  },
})

const transitionOptions = [
  { label: '淡入淡出', value: QuestionDisplayTransition.Fade },
  { label: '轻微滑动', value: QuestionDisplayTransition.Slide },
  { label: '缩放进入', value: QuestionDisplayTransition.Scale },
  { label: '无动画', value: QuestionDisplayTransition.None },
]

const shadowOptions = [
  { label: '无阴影', value: QuestionDisplayShadow.None },
  { label: '柔和阴影', value: QuestionDisplayShadow.Soft },
  { label: '强阴影', value: QuestionDisplayShadow.Strong },
]

const textShadowOptions = [
  { label: '无文字阴影', value: QuestionDisplayShadow.None },
  { label: '柔和文字阴影', value: QuestionDisplayShadow.Soft },
  { label: '强文字阴影', value: QuestionDisplayShadow.Strong },
]

const imageLayoutOptions = [
  { label: '逐张完整展示', value: QuestionDisplayImageLayout.Contain },
  { label: '网格裁切排列', value: QuestionDisplayImageLayout.Grid },
]

const fontWeightOptions = [
  { label: '常规 400', value: 400 },
  { label: '中等 500', value: 500 },
  { label: '半粗 600', value: 600 },
  { label: '加粗 700', value: 700 },
  { label: '特粗 800', value: 800 },
]

function colorValue(value?: string) {
  return value ? (value.startsWith('#') ? value : `#${value}`) : undefined
}

function updateColor(key: 'fontColor' | 'nameFontColor' | 'backgroundColor' | 'borderColor', value: string | null) {
  setting.value[key] = value ? value.replace('#', '').toUpperCase() : undefined
}

function applyPreset(value: QuestionDisplayVisualPreset) {
  setting.value = { ...setting.value, ...value }
}

function isPresetSelected(presetValue: QuestionDisplayVisualPreset): boolean {
  return (
    setting.value.fontColor === presetValue.fontColor &&
    setting.value.backgroundColor === presetValue.backgroundColor &&
    setting.value.backgroundOpacity === presetValue.backgroundOpacity &&
    setting.value.borderColor === presetValue.borderColor
  )
}

function resetToDefault() {
  const def = createDefaultQuestionDisplaySetting()
  setting.value = { ...def, syncScroll: setting.value.syncScroll }
}
</script>

<template>
  <div class="style-panel">
    <div class="preset-section">
      <div class="preset-header">
        <span class="preset-title">视觉预设</span>
        <NPopconfirm @positive-click="resetToDefault">
          <template #trigger>
            <NButton
              text
              size="tiny"
              type="default"
            >
              <template #icon><NIcon :component="ArrowReset24Regular" /></template>
              重置
            </NButton>
          </template>
          确定要将全部外观样式重置为默认配置吗？
        </NPopconfirm>
      </div>

      <div class="preset-grid">
        <button
          v-for="preset in QUESTION_DISPLAY_PRESETS"
          :key="preset.name"
          type="button"
          class="preset-card"
          :class="{ 'is-selected': isPresetSelected(preset.value) }"
          @click="applyPreset(preset.value)"
        >
          <div class="preset-preview-wrap">
            <div
              class="preset-preview"
              :style="{
                color: `#${preset.value.fontColor}`,
                backgroundColor:
                  preset.value.backgroundOpacity === 0 ? 'transparent' : `#${preset.value.backgroundColor}`,
                opacity: (preset.value.backgroundOpacity ?? 100) / 100,
                borderColor: preset.value.borderWidth ? `#${preset.value.borderColor}` : 'transparent',
                borderWidth: `${preset.value.borderWidth || 0}px`,
                borderRadius: `${Math.min(10, (preset.value.borderRadius || 0) / 2)}px`,
              }"
            >
              <span
                v-if="preset.value.showUserName"
                class="preview-name"
                :style="{ color: `#${preset.value.nameFontColor}` }"
                >提问者</span
              >
              <span class="preview-text">正文 Aa</span>
            </div>
            <span
              v-if="isPresetSelected(preset.value)"
              class="selected-badge"
            >
              <NIcon :component="Checkmark16Regular" />
            </span>
          </div>
          <strong class="preset-name">{{ preset.name }}</strong>
          <small class="preset-desc">{{ preset.description }}</small>
        </button>
      </div>
    </div>

    <section class="setting-section">
      <h3>文字排版</h3>
      <div class="font-columns">
        <NFormItem label="内容字体">
          <GoogleFontPicker
            v-model="contentFont"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            placeholder="选择内容字体"
          />
        </NFormItem>
        <NFormItem label="昵称字体">
          <GoogleFontPicker
            v-model="nameFont"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :clearable="false"
            :show-preview="false"
            placeholder="选择昵称字体"
          />
        </NFormItem>
      </div>

      <div class="two-columns">
        <NFormItem label="内容字号">
          <NInputNumber
            v-model:value="setting.fontSize"
            :min="12"
            :max="160"
          />
        </NFormItem>
        <NFormItem label="内容字重">
          <NSelect
            v-model:value="setting.fontWeight"
            :options="fontWeightOptions"
          />
        </NFormItem>
        <NFormItem label="昵称字号">
          <NInputNumber
            v-model:value="setting.nameFontSize"
            :min="12"
            :max="120"
          />
        </NFormItem>
        <NFormItem label="昵称字重">
          <NSelect
            v-model:value="setting.nameFontWeight"
            :options="fontWeightOptions"
          />
        </NFormItem>
      </div>

      <NFormItem label="行高倍数">
        <div class="slider-field">
          <NSlider
            v-model:value="setting.lineHeight"
            :min="1"
            :max="3"
            :step="0.05"
          />
          <NInputNumber
            v-model:value="setting.lineHeight"
            :min="1"
            :max="3"
            :step="0.05"
          />
        </div>
      </NFormItem>

      <div class="two-columns">
        <NFormItem label="水平对齐">
          <NRadioGroup v-model:value="setting.align">
            <NRadioButton :value="QuestionDisplayAlign.Left">左</NRadioButton>
            <NRadioButton :value="QuestionDisplayAlign.Center">中</NRadioButton>
            <NRadioButton :value="QuestionDisplayAlign.Right">右</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="垂直对齐">
          <NRadioGroup v-model:value="setting.verticalAlign">
            <NRadioButton :value="QuestionDisplayVerticalAlign.Top">上</NRadioButton>
            <NRadioButton :value="QuestionDisplayVerticalAlign.Center">中</NRadioButton>
            <NRadioButton :value="QuestionDisplayVerticalAlign.Bottom">下</NRadioButton>
          </NRadioGroup>
        </NFormItem>
      </div>

      <NFormItem label="内容最大宽度 (0 为不限)">
        <div class="slider-field">
          <NSlider
            v-model:value="setting.contentMaxWidth"
            :min="0"
            :max="80"
            :step="1"
          />
          <NInputNumber
            v-model:value="setting.contentMaxWidth"
            :min="0"
            :max="80"
            :step="1"
          />
        </div>
      </NFormItem>

      <NFormItem label="文字阴影">
        <NSelect
          v-model:value="setting.textShadow"
          :options="textShadowOptions"
        />
      </NFormItem>

      <div class="color-grid">
        <NFormItem label="内容文字颜色">
          <NColorPicker
            :value="colorValue(setting.fontColor)"
            :modes="['hex']"
            :show-alpha="false"
            @update:value="updateColor('fontColor', $event)"
          />
        </NFormItem>
        <NFormItem label="昵称文字颜色">
          <NColorPicker
            :value="colorValue(setting.nameFontColor)"
            :modes="['hex']"
            :show-alpha="false"
            @update:value="updateColor('nameFontColor', $event)"
          />
        </NFormItem>
      </div>
    </section>

    <section class="setting-section">
      <h3>卡片外观</h3>
      <div class="color-grid">
        <NFormItem label="背景颜色">
          <NColorPicker
            :value="colorValue(setting.backgroundColor)"
            :modes="['hex']"
            :show-alpha="false"
            @update:value="updateColor('backgroundColor', $event)"
          />
        </NFormItem>
        <NFormItem label="边框颜色">
          <NColorPicker
            :value="colorValue(setting.borderColor)"
            :modes="['hex']"
            :show-alpha="false"
            @update:value="updateColor('borderColor', $event)"
          />
        </NFormItem>
      </div>

      <NFormItem label="背景不透明度 (%)">
        <div class="slider-field">
          <NSlider
            v-model:value="setting.backgroundOpacity"
            :min="0"
            :max="100"
          />
          <NInputNumber
            v-model:value="setting.backgroundOpacity"
            :min="0"
            :max="100"
          />
        </div>
      </NFormItem>

      <div class="two-columns">
        <NFormItem label="内边距 (px)">
          <NInputNumber
            v-model:value="setting.contentPadding"
            :min="0"
            :max="96"
          />
        </NFormItem>
        <NFormItem label="卡片圆角 (px)">
          <NInputNumber
            v-model:value="setting.borderRadius"
            :min="0"
            :max="64"
          />
        </NFormItem>
        <NFormItem label="边框宽度 (px)">
          <NInputNumber
            v-model:value="setting.borderWidth"
            :min="0"
            :max="32"
          />
        </NFormItem>
        <NFormItem label="卡片阴影">
          <NSelect
            v-model:value="setting.shadow"
            :options="shadowOptions"
          />
        </NFormItem>
      </div>
    </section>

    <section class="setting-section">
      <h3>显示与动画</h3>
      <div class="switch-row">
        <span>显示提问者昵称</span>
        <NSwitch v-model:value="setting.showUserName" />
      </div>
      <div class="switch-row">
        <span>显示提问附图</span>
        <NSwitch v-model:value="setting.showImage" />
      </div>
      <div class="switch-row">
        <span>显示 VTsuru 标识</span>
        <NSwitch v-model:value="setting.showBrand" />
      </div>

      <div class="two-columns">
        <NFormItem label="附图排列">
          <NSelect
            v-model:value="setting.imageLayout"
            :options="imageLayoutOptions"
          />
        </NFormItem>
        <NFormItem label="切换动画">
          <NSelect
            v-model:value="setting.transition"
            :options="transitionOptions"
          />
        </NFormItem>
      </div>

      <NFormItem label="单图最大高度 (px)">
        <NInputNumber
          v-model:value="setting.imageMaxHeight"
          :min="80"
          :max="1080"
        />
      </NFormItem>
    </section>
  </div>
</template>

<style scoped>
.style-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.preset-section {
  display: grid;
  gap: 8px;
}

.preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preset-title {
  color: var(--vtsuru-fg);
  font-size: 13px;
  font-weight: 600;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px;
  text-align: left;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.preset-card:hover {
  background: var(--vtsuru-bg-elevated);
  border-color: var(--vtsuru-brand);
}

.preset-card.is-selected {
  background: var(--vtsuru-bg-elevated);
  border-color: var(--vtsuru-brand);
  box-shadow: 0 0 0 1px var(--vtsuru-brand);
}

.preset-preview-wrap {
  position: relative;
  width: 100%;
  height: 48px;
  margin-bottom: 6px;
  overflow: hidden;
  background-image: linear-gradient(45deg, #2b2f36 25%, transparent 25%),
    linear-gradient(-45deg, #2b2f36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2f36 75%),
    linear-gradient(-45deg, transparent 75%, #2b2f36 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
  background-color: #1e2227;
  border-radius: 4px;
}

.selected-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #ffffff;
  background: var(--vtsuru-brand);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgb(0 0 0 / 25%);
}

.preset-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 4px 6px;
  box-sizing: border-box;
  border-style: solid;
}

.preview-name {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.1;
}

.preview-text {
  font-size: 10px;
  line-height: 1.2;
}

.preset-name {
  color: var(--vtsuru-fg);
  font-size: 12px;
}

.preset-desc {
  display: -webkit-box;
  margin-top: 2px;
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 10px;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.setting-section {
  display: grid;
  gap: 2px;
  padding-top: 14px;
  border-top: 1px solid var(--vtsuru-border);
}

.setting-section h3 {
  margin: 0 0 8px;
  color: var(--vtsuru-fg);
  font-size: 13px;
  font-weight: 600;
}

.font-columns,
.two-columns,
.color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 10px;
  min-width: 0;
}

.slider-field {
  display: grid;
  grid-template-columns: 1fr 72px;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  color: var(--vtsuru-fg);
}
</style>
