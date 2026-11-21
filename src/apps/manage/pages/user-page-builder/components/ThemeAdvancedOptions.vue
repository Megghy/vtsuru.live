<script setup lang="ts">
import { computed } from 'vue'

import type { UserPageAppearanceTheme } from '@/apps/user-page/themeConfig'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tag } from '@/shared/ui/tag'

import PropsGrid from './PropsGrid.vue'

export interface ThemeAppearanceTarget {
  get: () => UserPageAppearanceTheme | undefined
  ensure: () => UserPageAppearanceTheme
  cleanup?: () => void
}

const props = defineProps<{ target: ThemeAppearanceTarget }>()

function setOptional<K extends keyof UserPageAppearanceTheme>(key: K, value: UserPageAppearanceTheme[K] | undefined) {
  const theme = props.target.get()
  if (value === undefined || value === '') {
    if (theme) delete theme[key]
    props.target.cleanup?.()
    return
  }
  Object.assign(props.target.ensure(), { [key]: value })
}

function optionalModel<K extends keyof UserPageAppearanceTheme>(key: K) {
  return computed<UserPageAppearanceTheme[K] | undefined>({
    get: () => props.target.get()?.[key],
    set: (value) => setOptional(key, value),
  })
}

const radius = computed<number | null>({
  get: () => props.target.get()?.radius ?? null,
  set: (value) => setOptional('radius', value ?? undefined),
})
const surfaceOpacity = computed<number | null>({
  get: () => props.target.get()?.surfaceOpacity ?? null,
  set: (value) => setOptional('surfaceOpacity', value ?? undefined),
})
const borderStrength = optionalModel('borderStrength')
const borderStyle = optionalModel('borderStyle')
const shadowLevel = optionalModel('shadowLevel')
const spacing = optionalModel('spacing')
const controlSize = optionalModel('controlSize')
const pageMaxWidth = computed({
  get: () => props.target.get()?.pageMaxWidth ?? '',
  set: (value: string) => setOptional('pageMaxWidth', value.trim() || undefined),
})

const advancedKeys: Array<keyof UserPageAppearanceTheme> = [
  'radius',
  'borderStrength',
  'borderStyle',
  'shadowLevel',
  'surfaceOpacity',
  'spacing',
  'controlSize',
  'pageMaxWidth',
]
const customCount = computed(() => advancedKeys.filter((key) => props.target.get()?.[key] !== undefined).length)
const hasAdvancedSettings = computed(() => customCount.value > 0)

function clearAdvancedSettings() {
  const theme = props.target.get()
  if (!theme) return
  advancedKeys.forEach((key) => delete theme[key])
  props.target.cleanup?.()
}

const radiusPresets = [
  { label: '直角 0px', value: 0 },
  { label: '微圆 6px', value: 6 },
  { label: '圆角 12px', value: 12 },
  { label: '大圆 20px', value: 20 },
]
</script>

<template>
  <Accordion class="advanced-options mt-2 border-t border-border">
    <AccordionItem
      value="appearance"
      class="border-b-0"
    >
      <AccordionTrigger class="text-xs font-semibold py-2">
        <div class="flex-between w-full pr-2">
          <span>高级外观选项</span>
          <Tag
            :variant="hasAdvancedSettings ? 'default' : 'outline'"
            size="tiny"
          >
            {{ hasAdvancedSettings ? `已自定义 ${customCount} 项` : '默认' }}
          </Tag>
        </div>
      </AccordionTrigger>

      <AccordionContent class="pt-1 pb-3 flex flex-col gap-3">
        <span class="text-xs text-muted-foreground"> 未设置的项目会继承全局主题或使用站点默认值。 </span>

        <PropsGrid :min-item-width="210">
          <FormField label="圆角大小">
            <NumberField
              v-model="radius"
              :min="0"
              :max="32"
              placeholder="默认 6px"
            />
            <div class="flex flex-wrap items-center gap-1 mt-1">
              <Button
                v-for="preset in radiusPresets"
                :key="preset.value"
                size="xs"
                :variant="radius === preset.value ? 'default' : 'ghost'"
                @click="radius = preset.value"
              >
                {{ preset.label }}
              </Button>
            </div>
          </FormField>

          <FormField label="边框强度">
            <Select v-model="borderStrength">
              <SelectTrigger>
                <SelectValue placeholder="继承（标准）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无边框</SelectItem>
                <SelectItem value="subtle">轻微</SelectItem>
                <SelectItem value="normal">标准</SelectItem>
                <SelectItem value="strong">明显</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="边框样式">
            <Select v-model="borderStyle">
              <SelectTrigger>
                <SelectValue placeholder="继承（实线）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">实线 (solid)</SelectItem>
                <SelectItem value="dashed">虚线 (dashed)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="阴影层级">
            <Select v-model="shadowLevel">
              <SelectTrigger>
                <SelectValue placeholder="继承（标准）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无阴影</SelectItem>
                <SelectItem value="subtle">轻微</SelectItem>
                <SelectItem value="normal">标准</SelectItem>
                <SelectItem value="floating">悬浮立体</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="表面不透明度 %">
            <NumberField
              v-model="surfaceOpacity"
              :min="15"
              :max="100"
              placeholder="跟随主题"
            />
          </FormField>

          <FormField label="布局密度">
            <Select v-model="spacing">
              <SelectTrigger>
                <SelectValue placeholder="继承（标准）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">紧凑 (compact)</SelectItem>
                <SelectItem value="normal">标准 (normal)</SelectItem>
                <SelectItem value="relaxed">宽松 (relaxed)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="组件尺寸">
            <Select v-model="controlSize">
              <SelectTrigger>
                <SelectValue placeholder="继承（标准）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">紧凑 (compact)</SelectItem>
                <SelectItem value="normal">标准 (normal)</SelectItem>
                <SelectItem value="comfortable">舒适 (comfortable)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="内容最大宽度">
            <Input
              v-model="pageMaxWidth"
              placeholder="默认 820px；例如 100% / 1200px"
            />
          </FormField>
        </PropsGrid>

        <div class="flex justify-end pt-1">
          <Button
            variant="outline"
            :disabled="!hasAdvancedSettings"
            @click="clearAdvancedSettings"
          >
            恢复高级选项默认值
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
