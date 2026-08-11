<script setup lang="ts">
import { CloudAdd20Filled } from '@vicons/fluent'
import { NButton, NIcon, NTooltip } from 'naive-ui'
import { computed } from 'vue'

import type { Setting_LiveRequest, SongsInfo } from '@/api/api-models'

import { getSongRequestButtonType, getSongRequestTooltip } from '../utils/songRequestUtils'

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

const buttonType = computed(() =>
  getSongRequestButtonType(props.song, props.liveRequestSettings, props.authState),
)
const tooltip = computed(() =>
  getSongRequestTooltip(props.song, props.liveRequestSettings, props.authState),
)
</script>

<template>
  <NTooltip
    v-if="!hidden"
    :disabled="disabled"
  >
    <template #trigger>
      <NButton
        :circle="circle"
        :size="size"
        :secondary="secondary"
        :type="buttonType"
        :loading="loading"
        :disabled="disabled"
        :aria-label="`点歌《${song.name}》`"
        @click="emit('request', song)"
      >
        <template
          v-if="circle || !label"
          #icon
        >
          <NIcon :component="CloudAdd20Filled" />
        </template>
        <template v-if="label">
          {{ label }}
        </template>
      </NButton>
    </template>
    {{ tooltip }}
  </NTooltip>
</template>
