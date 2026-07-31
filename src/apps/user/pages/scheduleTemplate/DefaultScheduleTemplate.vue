<script setup lang="ts">
import ScheduleList from '@/components/ScheduleList.vue'
import type { ScheduleConfigType } from '@/shared/types/TemplateTypes'

const props = defineProps<ScheduleConfigType>()
</script>

<template>
  <ScheduleList
    :schedules="props.data ?? []"
    :is-self="false"
    v-bind="$attrs"
  />
</template>
