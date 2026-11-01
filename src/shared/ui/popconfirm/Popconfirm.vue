<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { computed, ref, useSlots } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    positiveText?: string
    okText?: string
    negativeText?: string
    cancelText?: string
    showIcon?: boolean
    align?: 'center' | 'start' | 'end'
    side?: 'top' | 'right' | 'bottom' | 'left'
  }>(),
  {
    title: undefined,
    description: undefined,
    positiveText: undefined,
    okText: undefined,
    negativeText: undefined,
    cancelText: undefined,
    showIcon: true,
    align: 'center',
    side: 'top',
  },
)

const emit = defineEmits<{
  'positive-click': [e: MouseEvent]
  'negative-click': [e: MouseEvent]
  confirm: [e: MouseEvent]
  cancel: [e: MouseEvent]
}>()

const slots = useSlots()
const open = ref(false)

const hasTriggerSlot = computed(() => Boolean(slots.trigger))
const resolvedPositiveText = computed(() => props.positiveText ?? props.okText ?? '确定')
const resolvedNegativeText = computed(() => props.negativeText ?? props.cancelText ?? '取消')

function onConfirm(e: MouseEvent) {
  open.value = false
  emit('positive-click', e)
  emit('confirm', e)
}

function onCancel(e: MouseEvent) {
  open.value = false
  emit('negative-click', e)
  emit('cancel', e)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot
        v-if="hasTriggerSlot"
        name="trigger"
      />
      <slot v-else />
    </PopoverTrigger>
    <PopoverContent
      class="w-64 p-3 text-xs"
      :align="align"
      :side="side"
    >
      <div class="flex items-start gap-2.5">
        <AlertCircle
          v-if="showIcon"
          class="size-4 text-amber-500 shrink-0 mt-0.5"
        />
        <div class="flex-1 space-y-1">
          <div
            v-if="title"
            class="font-medium text-foreground text-xs"
          >
            {{ title }}
          </div>
          <div
            v-if="hasTriggerSlot"
            class="text-muted-foreground text-xs leading-relaxed"
          >
            <slot>{{ description }}</slot>
          </div>
          <div
            v-else-if="description || slots.description"
            class="text-muted-foreground text-xs leading-relaxed"
          >
            <slot name="description">
              {{ description }}
            </slot>
          </div>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          @click="onCancel"
        >
          {{ resolvedNegativeText }}
        </Button>
        <Button
          size="xs"
          variant="default"
          @click="onConfirm"
        >
          {{ resolvedPositiveText }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
