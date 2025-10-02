<script setup lang="ts">
import type { ScheduleConfigType } from '@/data/TemplateTypes'
import { NDivider } from 'naive-ui'
import { useAccount } from '@/api/account'
import ScheduleList from '@/components/ScheduleList.vue'

defineProps<ScheduleConfigType>()

const accountInfo = useAccount()
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
