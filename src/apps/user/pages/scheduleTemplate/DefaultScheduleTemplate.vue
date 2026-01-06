<script setup lang="ts">
import type { ScheduleConfigType } from '@/shared/types/TemplateTypes'
import { NDivider } from 'naive-ui'
import ScheduleList from '@/components/ScheduleList.vue'

defineProps<ScheduleConfigType>()
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <ScheduleList
    v-if="data"
    :schedules="data ?? []"
    :is-self="false"
    v-bind="$attrs"
  />
  <NDivider />
</template>
