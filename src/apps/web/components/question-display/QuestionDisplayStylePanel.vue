<script setup lang="ts">
import {
  NButton,
  NColorPicker,
  NFormItem,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSwitch,
} from 'naive-ui'

import type { Setting_QuestionDisplay } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
} from '@/api/api-models'
import { QUESTION_DISPLAY_PRESETS, type QuestionDisplayVisualPreset } from '@/shared/questionDisplayPresets'

const setting = defineModel<Setting_QuestionDisplay>({ required: true })

const fontOptions = [
  { label: '系统黑体', value: 'sans-serif' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '思源黑体', value: 'Source Han Sans SC' },
  { label: 'Noto Sans SC', value: 'Noto Sans SC' },
]

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
  return value ? `#${value}` : undefined
}

function updateColor(key: 'fontColor' | 'nameFontColor' | 'backgroundColor' | 'borderColor', value: string | null) {
  setting.value[key] = value?.replace('#', '').toUpperCase()
}

function applyPreset(value: QuestionDisplayVisualPreset) {
  setting.value = { ...setting.value, ...value }
}
</script>

<template>
  <div class="style-panel">
    <div class="preset-grid">
      <NButton
        v-for="preset in QUESTION_DISPLAY_PRESETS"
        :key="preset.name"
        secondary
        size="small"
        @click="applyPreset(preset.value)"
      >
        <span
          class="preset-swatch"
          :style="{
            color: `#${preset.value.fontColor}`,
            backgroundColor: preset.value.backgroundOpacity === 0 ? '#44484D' : `#${preset.value.backgroundColor}`,
            borderColor: `#${preset.value.borderColor}`,
          }"
          >Aa</span
        >
        {{ preset.name }}
      </NButton>
    </div>

    <section class="setting-section">
      <h3>文字</h3>
      <div class="two-columns">
        <NFormItem label="内容字体">
          <NSelect
            v-model:value="setting.font"
            :options="fontOptions"
            filterable
            tag
          />
        </NFormItem>
        <NFormItem label="昵称字体">
          <NSelect
            v-model:value="setting.nameFont"
            :options="fontOptions"
            filterable
            tag
          />
        </NFormItem>
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
      <NFormItem label="行高">
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
      <NFormItem label="文字对齐">
        <NRadioGroup v-model:value="setting.align">
          <NRadioButton :value="QuestionDisplayAlign.Left">左</NRadioButton>
          <NRadioButton :value="QuestionDisplayAlign.Center">中</NRadioButton>
          <NRadioButton :value="QuestionDisplayAlign.Right">右</NRadioButton>
        </NRadioGroup>
      </NFormItem>
      <div class="color-grid">
        <NFormItem label="内容颜色">
          <NColorPicker
            :value="colorValue(setting.fontColor)"
            :modes="['hex']"
            :show-alpha="false"
            @update:value="updateColor('fontColor', $event)"
          />
        </NFormItem>
        <NFormItem label="昵称颜色">
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
      <h3>卡片</h3>
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
      <NFormItem label="背景不透明度">
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
        <NFormItem label="内边距">
          <NInputNumber
            v-model:value="setting.contentPadding"
            :min="0"
            :max="96"
          />
        </NFormItem>
        <NFormItem label="圆角">
          <NInputNumber
            v-model:value="setting.borderRadius"
            :min="0"
            :max="64"
          />
        </NFormItem>
        <NFormItem label="边框宽度">
          <NInputNumber
            v-model:value="setting.borderWidth"
            :min="0"
            :max="32"
          />
        </NFormItem>
        <NFormItem label="阴影">
          <NSelect
            v-model:value="setting.shadow"
            :options="shadowOptions"
          />
        </NFormItem>
      </div>
    </section>

    <section class="setting-section">
      <h3>媒体与动画</h3>
      <div class="switch-row">
        <span>显示提问者昵称</span>
        <NSwitch v-model:value="setting.showUserName" />
      </div>
      <div class="switch-row">
        <span>显示提问图片</span>
        <NSwitch v-model:value="setting.showImage" />
      </div>
      <div class="switch-row">
        <span>显示 VTsuru 署名</span>
        <NSwitch v-model:value="setting.showBrand" />
      </div>
      <NFormItem label="图片排列">
        <NSelect
          v-model:value="setting.imageLayout"
          :options="imageLayoutOptions"
        />
      </NFormItem>
      <NFormItem label="图片最大高度">
        <NInputNumber
          v-model:value="setting.imageMaxHeight"
          :min="80"
          :max="1080"
        />
      </NFormItem>
      <NFormItem label="切换动画">
        <NSelect
          v-model:value="setting.transition"
          :options="transitionOptions"
        />
      </NFormItem>
    </section>
  </div>
</template>

<style scoped>
.style-panel {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.preset-swatch {
  display: inline-grid;
  width: 24px;
  height: 18px;
  margin-right: 6px;
  place-items: center;
  border: 1px solid;
  border-radius: 3px;
  font-size: 9px;
  line-height: 1;
}

.setting-section {
  display: grid;
  gap: 2px;
  padding-top: 16px;
  border-top: 1px solid var(--vtsuru-border);
}

.setting-section h3 {
  margin: 0 0 10px;
  color: var(--vtsuru-fg);
  font-size: 13px;
}

.two-columns,
.color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 10px;
  min-width: 0;
}

.slider-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  color: var(--vtsuru-fg);
  font-size: 13px;
}

:deep(.n-form-item) {
  min-width: 0;
}

@media (max-width: 420px) {
  .preset-grid,
  .two-columns,
  .color-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
