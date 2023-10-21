<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import ScheduleList from '@/components/ScheduleList.vue'
import { NDivider } from 'naive-ui'

const accountInfo = useAccount()

defineProps<{
  userInfo: UserInfo | undefined
  currentData: ScheduleWeekInfo[] | undefined
}>()
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <ScheduleList v-if="currentData" :schedules="currentData ?? []" :is-self="accountInfo?.id == userInfo?.id" v-bind="$attrs" />
  <NDivider />
</template>
