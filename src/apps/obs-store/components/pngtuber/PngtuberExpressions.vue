<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { createExpression, IMAGE_SLOTS } from '@/shared/pngtuber/types'
import type { ImageSlot, PngtuberExpression, PngtuberState } from '@/shared/pngtuber/types'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

import PngtuberAccessories from './PngtuberAccessories.vue'
import PngtuberImageSlot from './PngtuberImageSlot.vue'

const props = defineProps<{ state: PngtuberState; disabled: boolean; controlDisabled: boolean }>()
const emit = defineEmits<{ change: [patch: Partial<PngtuberState>]; activate: [expression: PngtuberExpression] }>()
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
const labels: Record<ImageSlot, string> = {
  idleImage: '静止 / 睁眼',
  speakingImage: '说话 / 睁眼',
  idleBlinkImage: '静止 / 闭眼',
  speakingBlinkImage: '说话 / 闭眼',
}
function patch(value: Partial<PngtuberExpression>) {
  if (!props.disabled)
    emit('change', {
      expressions: props.state.expressions.map((e) => (e.id === expression.value.id ? { ...e, ...value } : e)),
    })
}
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
  <Card class="p-3">
    <CardHeader class="p-0 pb-2">
      <CardTitle class="text-sm font-semibold">表情与配件</CardTitle>
    </CardHeader>
    <CardContent class="p-0 space-y-3">
      <Select v-model="selected">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="选择表情" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" :disabled="disabled || state.expressions.length>= 32"
          @click="add()"
        >
          新增
        </Button>
        <Button variant="outline" :disabled="disabled || state.expressions.length>= 32"
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
            <Button variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10" :disabled="disabled || state.expressions.length <= 1">
              删除
            </Button>
          </template>
          删除此表情及其配件？
        </Popconfirm>
        <Button :disabled="controlDisabled" @click="emit('activate', expression)">
          切换表情
        </Button>
      </div>

      <Input :value="expression.name" :disabled="disabled" placeholder="表情名称" @input="patch({ name: ($event.target as HTMLInputElement).value })" />

      <div class="fields">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground font-medium">默认表情</label>
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
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground font-medium">暂离表情</label>
          <Select
            :model-value="state.awayExpressionId"
            :disabled="disabled"
            @update:model-value="emit('change', { awayExpressionId: $event ? String($event) : undefined })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" class="text-xs">使用默认表情</SelectItem>
              <SelectItem
                v-for="opt in options"
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

      <div class="fields">
        <PngtuberImageSlot
          v-for="slot in IMAGE_SLOTS"
          :key="`${expression.id}:${slot}`"
          :value="expression[slot]"
          :label="labels[slot]"
          :disabled="disabled"
          @change="patch({ [slot]: $event })"
        />
      </div>

      <Button variant="outline" :disabled="disabled || !expression.idleImage" @click="patch({ speakingImage: expression.idleImage })">
        将静止立绘用于说话
      </Button>

      <div class="fields">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground font-medium">快捷键（按键录入，退格清除）</label>
          <Input :value="expression.hotkey" readonly :disabled="disabled" placeholder="点击后按快捷键" @keydown="recordKey" />
        </div>

        <div class="space-y-1">
          <label class="text-xs text-muted-foreground font-medium">快捷键模式</label>
          <Select
            :model-value="expression.hotkeyMode"
            :disabled="disabled"
            @update:model-value="patch({ hotkeyMode: $event as any })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toggle" class="text-xs">切换</SelectItem>
              <SelectItem value="hold" class="text-xs">按住</SelectItem>
              <SelectItem value="timed" class="text-xs">定时</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div v-if="expression.hotkeyMode === 'timed'" class="space-y-1">
        <label class="text-xs text-muted-foreground font-medium">持续时长 (ms)</label>
        <NInputNumber
          :value="expression.durationMs"
          :disabled="disabled"
          :min="100"
          :max="600000"
          :step="100"
          class="w-full"
          @update:value="(value) => value !== null && patch({ durationMs: value })"
        />
      </div>

      <div class="text-xs text-muted-foreground leading-relaxed">
        网页快捷键在本页获得焦点时生效，编辑输入框时暂停。按住模式松开后恢复原表情。
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground font-medium">动图播放</label>
        <Select
          :model-value="expression.playback"
          :disabled="disabled"
          @update:model-value="patch({ playback: $event as any })"
        >
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue" class="text-xs">继续播放</SelectItem>
            <SelectItem value="restart" class="text-xs">激活时重播</SelectItem>
            <SelectItem value="once" class="text-xs">播放一次</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PngtuberAccessories
        :key="expression.id"
        :accessories="expression.accessories"
        :disabled="disabled"
        @change="patch({ accessories: $event })"
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
