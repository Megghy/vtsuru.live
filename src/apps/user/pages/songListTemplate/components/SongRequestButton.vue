<script setup lang="ts">
import { CloudAdd20Filled } from '@vicons/fluent'
import { computed } from 'vue'

import type { ResponseSongModel, SettingSongRequest } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { getSongRequestTooltip } from '../utils/songRequestUtils'

const props = withDefaults(
  defineProps<{
    song: ResponseSongModel
    liveRequestSettings?: SettingSongRequest
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
  request: [song: ResponseSongModel]
}>()

const tooltip = computed(() => getSongRequestTooltip(props.song, props.liveRequestSettings, props.authState))

const buttonSize = computed(() => {
  if (props.circle && !props.label) {
    return props.size === 'tiny' ? 'icon-xs' : 'icon-sm'
  }
  if (props.size === 'tiny') return 'xs'
  if (props.size === 'large') return 'default'
  return 'sm'
})
</script>

<template>
  <TooltipProvider v-if="!hidden">
    <Tooltip :disabled="disabled">
      <TooltipTrigger as-child>
        <Button
          :variant="secondary ? 'secondary' : 'default'"
          :size="buttonSize"
          :class="[circle && !label ? 'rounded-full' : '']"
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
      <TooltipContent>{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
