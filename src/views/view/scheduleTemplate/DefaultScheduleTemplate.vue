<script setup lang="ts">
import { useAccount } from '@/api/account';
import ScheduleList from '@/components/ScheduleList.vue';
import { ScheduleConfigType } from '@/data/TemplateTypes';
import { NDivider } from 'naive-ui';

const accountInfo = useAccount()

defineProps<ScheduleConfigType>()
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <ScheduleList v-if="data" :schedules="data ?? []" :is-self="false" v-bind="$attrs" />
  <NDivider />
</template>
