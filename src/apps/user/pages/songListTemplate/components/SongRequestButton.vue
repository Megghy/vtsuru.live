<script setup lang="ts">
import { CloudAdd20Filled } from '@vicons/fluent'
import { computed } from 'vue'

import type { Setting_LiveRequest, SongsInfo } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { getSongRequestTooltip } from '../utils/songRequestUtils'

const props = withDefaults(
  defineProps<{
    song: SongsInfo
    liveRequestSettings?: Setting_LiveRequest
    authState: { isLoggedIn: boolean; isBiliAuthed: boolean }
    loading?: boolean
    disabled?: boolean
    hidden?: boolean
    circle?: boolean
    size?: 'tiny' | 'small' | 'medium' | 'large'
    secondary?: boolean
    label?: string
  }>(),
  {
    loading: false,
    disabled: false,
    hidden: false,
    circle: true,
    size: 'small',
    secondary: false,
  },
)

const emit = defineEmits<{
  request: [song: SongsInfo]
}>()

const tooltip = computed(() =>
  getSongRequestTooltip(props.song, props.liveRequestSettings, props.authState),
)
</script>

<template>
  <TooltipProvider v-if="!hidden">
    <Tooltip :disabled="disabled">
      <TooltipTrigger as-child>
        <Button
          :variant="secondary ? 'secondary' : 'default'"
          :size="circle && !label ? 'icon' : 'sm'"
          :class="[
            circle && !label ? 'size-7 rounded-full' : 'h-7 text-xs px-2.5',
            size === 'tiny' && circle ? 'size-6' : '',
            size === 'large' ? 'h-9 px-4 text-sm' : '',
          ]"
          :disabled="disabled || loading"
          :aria-label="`点歌《${song.name}》`"
          @click="emit('request', song)"
        >
          <component
            :is="CloudAdd20Filled"
            class="size-3.5"
            :class="{ 'mr-1': !!label }"
          />
          <span v-if="label">{{ label }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent class="text-xs">{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
