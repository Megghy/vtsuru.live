<script setup lang="ts">
import { ArrowReset24Regular, Checkmark16Regular } from '@vicons/fluent'
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
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'

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
  <div class="style-panel space-y-5 text-xs">
    <!-- 预设 -->
    <div class="preset-section space-y-2.5">
      <div class="preset-header flex items-center justify-between">
        <span class="preset-title text-xs font-semibold text-foreground">视觉预设</span>
        <Popconfirm
          title="重置样式？"
          positive-text="重置"
          negative-text="取消"
          @positive-click="resetToDefault"
        >
          <template #trigger>
            <Button
              variant="ghost"
              class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <component
                :is="ArrowReset24Regular"
                class="size-3.5"
              />
              重置
            </Button>
          </template>
          确定要将全部外观样式重置为默认配置吗？
        </Popconfirm>
      </div>

      <div class="preset-grid grid grid-cols-2 gap-2">
        <button
          v-for="preset in QUESTION_DISPLAY_PRESETS"
          :key="preset.name"
          type="button"
          class="preset-card p-2 rounded-lg border text-left flex flex-col gap-1 transition cursor-pointer"
          :class="[
            isPresetSelected(preset.value)
              ? 'border-primary bg-primary/5 shadow-xs'
              : 'border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50',
          ]"
          @click="applyPreset(preset.value)"
        >
          <div
            class="preset-preview-wrap relative w-full h-12 rounded overflow-hidden flex items-center justify-center border border-border/50"
          >
            <div
              class="preset-preview w-full h-full p-1.5 flex flex-col justify-center items-center text-center transition"
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
                class="preview-name text-[9px] truncate"
                :style="{ color: `#${preset.value.nameFontColor}` }"
              >
                提问者
              </span>
              <span class="preview-text text-[10px] font-bold">正文 Aa</span>
            </div>
            <span
              v-if="isPresetSelected(preset.value)"
              class="selected-badge absolute top-1 right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs"
            >
              <component
                :is="Checkmark16Regular"
                class="size-2.5"
              />
            </span>
          </div>
          <strong class="preset-name text-xs text-foreground mt-0.5">{{ preset.name }}</strong>
          <small class="preset-desc text-[10px] text-muted-foreground line-clamp-1">{{ preset.description }}</small>
        </button>
      </div>
    </div>

    <!-- 文字排版 -->
    <section class="setting-section space-y-3 pt-3 border-t border-border/60">
      <h3 class="text-xs font-semibold text-foreground uppercase tracking-wider">文字排版</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">内容字体</label>
          <GoogleFontPicker
            v-model="contentFont"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            placeholder="选择内容字体"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">昵称字体</label>
          <GoogleFontPicker
            v-model="nameFont"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :clearable="false"
            :show-preview="false"
            placeholder="选择昵称字体"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">内容字号</label>
          <NInputNumber
            v-model:value="setting.fontSize"
            :min="12"
            :max="160"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">内容字重</label>
          <Select
            :model-value="String(setting.fontWeight ?? 400)"
            @update:model-value="setting.fontWeight = Number($event)"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in fontWeightOptions"
                :key="opt.value"
                :value="String(opt.value)"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">昵称字号</label>
          <NInputNumber
            v-model:value="setting.nameFontSize"
            :min="12"
            :max="120"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">昵称字重</label>
          <Select
            :model-value="String(setting.nameFontWeight ?? 400)"
            @update:model-value="setting.nameFontWeight = Number($event)"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in fontWeightOptions"
                :key="opt.value"
                :value="String(opt.value)"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-medium">行高倍数</span>
          <span class="font-mono">{{ setting.lineHeight }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Slider
            :model-value="[setting.lineHeight ?? 1.5]"
            :min="1"
            :max="3"
            :step="0.05"
            class="flex-1"
            @update:model-value="setting.lineHeight = $event?.[0] ?? 1.5"
          />
          <NInputNumber
            v-model:value="setting.lineHeight"
            :min="1"
            :max="3"
            :step="0.05"
            class="w-20"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">水平对齐</label>
          <div class="flex items-center bg-muted/60 p-0.5 rounded-md">
            <button
              v-for="al in [
                { label: '左', value: QuestionDisplayAlign.Left },
                { label: '中', value: QuestionDisplayAlign.Center },
                { label: '右', value: QuestionDisplayAlign.Right },
              ]"
              :key="al.value"
              type="button"
              class="flex-1 py-1 text-center rounded transition"
              :class="
                setting.align === al.value
                  ? 'bg-background shadow-xs text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="setting.align = al.value"
            >
              {{ al.label }}
            </button>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">垂直对齐</label>
          <div class="flex items-center bg-muted/60 p-0.5 rounded-md">
            <button
              v-for="val in [
                { label: '上', value: QuestionDisplayVerticalAlign.Top },
                { label: '中', value: QuestionDisplayVerticalAlign.Center },
                { label: '下', value: QuestionDisplayVerticalAlign.Bottom },
              ]"
              :key="val.value"
              type="button"
              class="flex-1 py-1 text-center rounded transition"
              :class="
                setting.verticalAlign === val.value
                  ? 'bg-background shadow-xs text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="setting.verticalAlign = val.value"
            >
              {{ val.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-medium">内容最大宽度 (0 为不限)</span>
          <span class="font-mono">{{ setting.contentMaxWidth || 0 }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Slider
            :model-value="[setting.contentMaxWidth ?? 0]"
            :min="0"
            :max="80"
            :step="1"
            class="flex-1"
            @update:model-value="setting.contentMaxWidth = $event?.[0] ?? 0"
          />
          <NInputNumber
            v-model:value="setting.contentMaxWidth"
            :min="0"
            :max="80"
            :step="1"
            class="w-20"
          />
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-[11px] text-muted-foreground font-medium">文字阴影</label>
        <Select
          :model-value="setting.textShadow ?? QuestionDisplayShadow.None"
          @update:model-value="setting.textShadow = $event as any"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in textShadowOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">内容文字颜色</label>
          <ColorPicker
            :model-value="colorValue(setting.fontColor)"
            :show-alpha="false"
            @update:model-value="updateColor('fontColor', $event)"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">昵称文字颜色</label>
          <ColorPicker
            :model-value="colorValue(setting.nameFontColor)"
            :show-alpha="false"
            @update:model-value="updateColor('nameFontColor', $event)"
          />
        </div>
      </div>
    </section>

    <!-- 卡片外观 -->
    <section class="setting-section space-y-3 pt-3 border-t border-border/60">
      <h3 class="text-xs font-semibold text-foreground uppercase tracking-wider">卡片外观</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">背景颜色</label>
          <ColorPicker
            :model-value="colorValue(setting.backgroundColor)"
            :show-alpha="false"
            @update:model-value="updateColor('backgroundColor', $event)"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">边框颜色</label>
          <ColorPicker
            :model-value="colorValue(setting.borderColor)"
            :show-alpha="false"
            @update:model-value="updateColor('borderColor', $event)"
          />
        </div>
      </div>

      <div class="space-y-1">
        <div class="flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-medium">背景不透明度 (%)</span>
          <span class="font-mono">{{ setting.backgroundOpacity ?? 100 }}%</span>
        </div>
        <div class="flex items-center gap-2">
          <Slider
            :model-value="[setting.backgroundOpacity ?? 100]"
            :min="0"
            :max="100"
            class="flex-1"
            @update:model-value="setting.backgroundOpacity = $event?.[0] ?? 100"
          />
          <NInputNumber
            v-model:value="setting.backgroundOpacity"
            :min="0"
            :max="100"
            class="w-20"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">内边距 (px)</label>
          <NInputNumber
            v-model:value="setting.contentPadding"
            :min="0"
            :max="96"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">卡片圆角 (px)</label>
          <NInputNumber
            v-model:value="setting.borderRadius"
            :min="0"
            :max="64"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">边框宽度 (px)</label>
          <NInputNumber
            v-model:value="setting.borderWidth"
            :min="0"
            :max="32"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">卡片阴影</label>
          <Select
            :model-value="setting.shadow ?? QuestionDisplayShadow.None"
            @update:model-value="setting.shadow = $event as any"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in shadowOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>

    <!-- 显示与动画 -->
    <section class="setting-section space-y-3 pt-3 border-t border-border/60">
      <h3 class="text-xs font-semibold text-foreground uppercase tracking-wider">显示与动画</h3>
      <div class="space-y-2">
        <div class="switch-row flex items-center justify-between py-1">
          <span class="text-xs text-foreground">显示提问者昵称</span>
          <Switch v-model:checked="setting.showUserName" />
        </div>
        <div class="switch-row flex items-center justify-between py-1">
          <span class="text-xs text-foreground">显示提问附图</span>
          <Switch v-model:checked="setting.showImage" />
        </div>
        <div class="switch-row flex items-center justify-between py-1">
          <span class="text-xs text-foreground">显示 VTsuru 标识</span>
          <Switch v-model:checked="setting.showBrand" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-1">
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">附图排列</label>
          <Select
            :model-value="setting.imageLayout ?? QuestionDisplayImageLayout.Contain"
            @update:model-value="setting.imageLayout = $event as any"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in imageLayoutOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-muted-foreground font-medium">切换动画</label>
          <Select
            :model-value="setting.transition ?? QuestionDisplayTransition.Fade"
            @update:model-value="setting.transition = $event as any"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in transitionOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-[11px] text-muted-foreground font-medium">单图最大高度 (px)</label>
        <NInputNumber
          v-model:value="setting.imageMaxHeight"
          :min="80"
          :max="1080"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.style-panel {
  width: 100%;
  min-width: 0;
}
</style>
