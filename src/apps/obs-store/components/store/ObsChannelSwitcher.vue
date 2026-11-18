<script setup lang="ts">
import { HelpCircle } from 'lucide-vue-next'

import { OBS_SYNC_CHANNEL_HINT } from '@/apps/obs-store/sync'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

const modelValue = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    disabled?: boolean
    buttonVariant?: 'secondary' | 'outline'
    buttonLabel?: string
    placeholder?: string
    inputClass?: string
  }>(),
  {
    disabled: false,
    buttonVariant: 'secondary',
    buttonLabel: '切换频道',
    placeholder: '频道',
    inputClass: 'w-[120px]',
  },
)

const emit = defineEmits<{
  submit: []
}>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <Input
      v-model="modelValue"
      :class="cn(inputClass)"
      :placeholder="placeholder"
      maxlength="64"
      :disabled="disabled"
      @keyup.enter="emit('submit')"
    />
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          :variant="buttonVariant"
          :disabled="disabled"
          class="gap-1"
          @click="emit('submit')"
        >
          <span>{{ buttonLabel }}</span>
          <HelpCircle class="size-3.5 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="max-w-xs leading-relaxed">
        <div class="font-medium mb-0.5">多开实例同步频道</div>
        <div class="text-muted-foreground">
          仅频道名一致的控制台与 OBS 源会实时同步；可在不同 OBS 场景填写不同频道名实现独立控制。{{
            OBS_SYNC_CHANNEL_HINT
          }}。
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
</template>
