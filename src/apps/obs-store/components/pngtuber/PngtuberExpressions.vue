<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { createExpression } from '@/shared/pngtuber/types'
import type {
  IdleAnimationType,
  ImageSlot,
  PngtuberExpression,
  PngtuberState,
  SpeakingAnimationType,
} from '@/shared/pngtuber/types'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import PngtuberAccessories from './PngtuberAccessories.vue'
import PngtuberImageSlot from './PngtuberImageSlot.vue'

const props = defineProps<{
  state: PngtuberState
  disabled: boolean
  controlDisabled: boolean
  selectedAccessoryId?: string
}>()

const emit = defineEmits<{
  change: [patch: Partial<PngtuberState>]
  activate: [expression: PngtuberExpression]
  'select-expression': [id: string]
  'locate-accessory': [payload: { expressionId: string; accessoryId: string }]
}>()

const selected = ref(props.state.defaultExpressionId)
const expression = computed(
  () => props.state.expressions.find((e) => e.id === selected.value) ?? props.state.expressions[0],
)
const options = computed(() => props.state.expressions.map((e) => ({ label: e.name || '未命名表情', value: e.id })))

watch(
  () => props.state.expressions,
  () => {
    if (!props.state.expressions.some((e) => e.id === selected.value)) selected.value = props.state.defaultExpressionId
  },
)

watch(
  () => expression.value.id,
  (id) => emit('select-expression', id),
  { immediate: true },
)

const baseSlots: ImageSlot[] = ['idleImage', 'speakingImage', 'idleBlinkImage', 'speakingBlinkImage']
const labels: Record<ImageSlot, string> = {
  idleImage: '静止 / 睁眼',
  speakingImage: '说话 / 睁眼',
  idleBlinkImage: '静止 / 闭眼',
  speakingBlinkImage: '说话 / 闭眼',
  shoutImage: '大声 / 尖叫（音量 ≥ 尖叫阈值时显示，可选）',
}

const speakingAnimOptions: Array<{ value: string; label: string }> = [
  { value: '__inherit__', label: '跟随全局说话动效' },
  { value: 'bounce', label: '弹跳' },
  { value: 'jelly', label: '果冻' },
  { value: 'shake', label: '晃动' },
  { value: 'pulse', label: '脉冲' },
  { value: 'float', label: '悬浮' },
  { value: 'none', label: '无' },
]

const idleAnimOptions: Array<{ value: string; label: string }> = [
  { value: '__inherit__', label: '跟随全局待机动效' },
  { value: 'breathe', label: '呼吸' },
  { value: 'sway', label: '微晃' },
  { value: 'float', label: '漂浮' },
  { value: 'none', label: '静止' },
]

function patch(value: Partial<PngtuberExpression>) {
  if (!props.disabled)
    emit('change', {
      expressions: props.state.expressions.map((e) => (e.id === expression.value.id ? { ...e, ...value } : e)),
    })
}

const patchNameDebounced = useDebounceFn((name: string) => {
  patch({ name })
}, 300)

function add(copy = false) {
  if (props.disabled || props.state.expressions.length >= 32) return
  const next = copy
    ? {
        ...(JSON.parse(JSON.stringify(expression.value)) as PngtuberExpression),
        id: crypto.randomUUID(),
        name: `${expression.value.name} 副本`,
        hotkey: '',
      }
    : createExpression('新表情')
  next.accessories = next.accessories.map((a) => ({ ...a, id: crypto.randomUUID() }))
  emit('change', { expressions: [...props.state.expressions, next] })
  selected.value = next.id
}

function remove() {
  if (props.disabled || props.state.expressions.length <= 1) return
  const id = expression.value.id
  const expressions = props.state.expressions.filter((e) => e.id !== id)
  emit('change', {
    expressions,
    defaultExpressionId: props.state.defaultExpressionId === id ? expressions[0].id : props.state.defaultExpressionId,
    awayExpressionId: props.state.awayExpressionId === id ? '' : props.state.awayExpressionId,
  })
}

function recordKey(event: KeyboardEvent) {
  if (event.key === 'Tab') return
  event.preventDefault()
  event.stopPropagation()
  if (props.disabled || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
  patch({
    hotkey:
      event.key === 'Backspace' || event.key === 'Delete'
        ? ''
        : [
            ...(event.ctrlKey ? ['Ctrl'] : []),
            ...(event.altKey ? ['Alt'] : []),
            ...(event.shiftKey ? ['Shift'] : []),
            ...(event.metaKey ? ['Meta'] : []),
            event.code,
          ].join('+'),
  })
}
</script>

<template>
  <Card>
    <CardHeader class="pb-3">
      <CardTitle>表情与配件</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <Select v-model="selected">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="选择表情" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          :disabled="disabled || state.expressions.length >= 32"
          @click="add()"
        >
          新增
        </Button>
        <Button
          variant="outline"
          :disabled="disabled || state.expressions.length >= 32"
          @click="add(true)"
        >
          复制
        </Button>
        <Popconfirm
          title="删除表情"
          :disabled="disabled || state.expressions.length <= 1"
          @positive-click="remove"
        >
          <template #trigger>
            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="disabled || state.expressions.length <= 1"
            >
              删除
            </Button>
          </template>
          删除此表情及其配件？
        </Popconfirm>
        <Button
          :disabled="controlDisabled"
          @click="emit('activate', expression)"
        >
          切换表情
        </Button>
      </div>

      <Input
        :model-value="expression.name"
        :disabled="disabled"
        placeholder="表情名称"
        @input="patchNameDebounced(($event.target as HTMLInputElement).value)"
      />

      <div class="fields">
        <FormField
          label="默认表情"
          class="min-w-0"
        >
          <Select
            :model-value="state.defaultExpressionId"
            :disabled="disabled"
            @update:model-value="emit('change', { defaultExpressionId: String($event ?? '') })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in options"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="暂离表情"
          class="min-w-0"
        >
          <Select
            :model-value="state.awayExpressionId || '__default__'"
            :disabled="disabled"
            @update:model-value="
              emit('change', { awayExpressionId: $event && $event !== '__default__' ? String($event) : '' })
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__"> 使用默认表情 </SelectItem>
              <SelectItem
                v-for="opt in options"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div class="fields">
        <PngtuberImageSlot
          v-for="slot in baseSlots"
          :key="`${expression.id}:${slot}`"
          :value="expression[slot]"
          :label="labels[slot]"
          :disabled="disabled"
          @change="patch({ [slot]: $event })"
        />
      </div>

      <PngtuberImageSlot
        :key="`${expression.id}:shoutImage`"
        :value="expression.shoutImage"
        :label="labels.shoutImage"
        :disabled="disabled"
        @change="patch({ shoutImage: $event })"
      />

      <Button
        variant="outline"
        :disabled="disabled || !expression.idleImage"
        @click="patch({ speakingImage: expression.idleImage })"
      >
        将静止立绘用于说话
      </Button>

      <div class="fields">
        <FormField
          label="表情专属说话动效"
          class="min-w-0"
        >
          <Select
            :model-value="expression.speakingAnimation || '__inherit__'"
            :disabled="disabled"
            @update:model-value="
              patch({
                speakingAnimation: $event === '__inherit__' ? '' : ($event as SpeakingAnimationType),
              })
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in speakingAnimOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="表情专属待机动效"
          class="min-w-0"
        >
          <Select
            :model-value="expression.idleAnimation || '__inherit__'"
            :disabled="disabled"
            @update:model-value="
              patch({
                idleAnimation: $event === '__inherit__' ? '' : ($event as IdleAnimationType),
              })
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in idleAnimOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div class="fields">
        <FormField
          label="快捷键（按键录入，退格清除）"
          class="min-w-0"
        >
          <Input
            :model-value="expression.hotkey"
            readonly
            :disabled="disabled"
            placeholder="点击后按快捷键"
            @keydown="recordKey"
          />
        </FormField>

        <FormField
          label="快捷键模式"
          class="min-w-0"
        >
          <Select
            :model-value="expression.hotkeyMode"
            :disabled="disabled"
            @update:model-value="patch({ hotkeyMode: $event as PngtuberExpression['hotkeyMode'] })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toggle">切换</SelectItem>
              <SelectItem value="hold">按住</SelectItem>
              <SelectItem value="timed">定时</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField
        v-if="expression.hotkeyMode === 'timed'"
        label="持续时长 (ms)"
      >
        <NumberField
          :model-value="expression.durationMs"
          :disabled="disabled"
          :min="100"
          :max="600000"
          :step="100"
          class="w-full"
          @update:model-value="(value) => value !== null && patch({ durationMs: value })"
        />
      </FormField>

      <div class="text-xs text-muted-foreground leading-relaxed">
        网页快捷键在本页获得焦点时生效，编辑输入框时暂停。按住模式松开后恢复原表情。
      </div>

      <FormField label="动图播放">
        <Select
          :model-value="expression.playback"
          :disabled="disabled"
          @update:model-value="patch({ playback: $event as PngtuberExpression['playback'] })"
        >
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">继续播放</SelectItem>
            <SelectItem value="restart">激活时重播</SelectItem>
            <SelectItem value="once">播放一次</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <PngtuberAccessories
        :key="expression.id"
        :accessories="expression.accessories"
        :disabled="disabled"
        :selected-accessory-id="selectedAccessoryId"
        @change="patch({ accessories: $event })"
        @locate-accessory="emit('locate-accessory', { expressionId: expression.id, accessoryId: $event })"
      />
    </CardContent>
  </Card>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
