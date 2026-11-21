<script setup lang="ts">
import { Ban, Send } from 'lucide-vue-next'
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

const isUnavailable = computed(() => props.disabled || Boolean(props.song.isDisabled))
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
    <Tooltip>
      <TooltipTrigger as-child>
        <span class="inline-flex">
          <Button
            :variant="secondary ? 'secondary' : 'default'"
            :size="buttonSize"
            :class="[circle && !label ? 'rounded-full' : '']"
            :disabled="isUnavailable || loading"
            :aria-label="song.isDisabled ? `${song.name} 暂不接歌` : `点歌《${song.name}》`"
            @click="emit('request', song)"
          >
            <component
              :is="song.isDisabled ? Ban : Send"
              class="size-3.5"
              :class="{ 'mr-1': !!label }"
            />
            <span v-if="label">{{ song.isDisabled ? '暂不接歌' : label }}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
