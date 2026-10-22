<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

withDefaults(
  defineProps<{
    positiveText?: string
    negativeText?: string
    showIcon?: boolean
    title?: string
  }>(),
  {
    positiveText: '确定',
    negativeText: '取消',
    showIcon: true,
  },
)

const emit = defineEmits<{
  'positive-click': [e: MouseEvent]
  'negative-click': [e: MouseEvent]
}>()

const open = ref(false)

function onConfirm(e: MouseEvent) {
  open.value = false
  emit('positive-click', e)
}

function onCancel(e: MouseEvent) {
  open.value = false
  emit('negative-click', e)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent
      class="w-64 p-3 text-xs"
      align="center"
      side="top"
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
          <div class="text-muted-foreground text-xs leading-relaxed">
            <slot />
          </div>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          class="h-6 px-2 text-[11px]"
          @click="onCancel"
        >
          {{ negativeText }}
        </Button>
        <Button
          size="xs"
          variant="default"
          class="h-6 px-2 text-[11px]"
          @click="onConfirm"
        >
          {{ positiveText }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
