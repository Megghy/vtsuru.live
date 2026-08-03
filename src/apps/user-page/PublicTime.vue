<script setup lang="ts">
import { format as formatDate, formatDistanceToNowStrict } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    time: string | number | Date
    type?: 'relative' | 'date'
    format?: string
  }>(),
  {
    type: 'date',
    format: 'yyyy-MM-dd HH:mm:ss',
  },
)

const date = computed(() => new Date(props.time))
const label = computed(() =>
  props.type === 'relative'
    ? formatDistanceToNowStrict(date.value, { addSuffix: true, locale: zhCN })
    : formatDate(date.value, props.format, { locale: zhCN }),
)
</script>

<template>
  <time :datetime="date.toISOString()">{{ label }}</time>
</template>
