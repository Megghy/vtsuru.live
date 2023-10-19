<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { NGrid, NList, NListItem, NSpace, NCard, NEmpty, NGridItem } from 'naive-ui'
import { ref } from 'vue'
import { ScheduleWeekInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/data/constants'

const { width } = useWindowSize()

defineProps<{
  schedules: ScheduleWeekInfo[]
}>()
</script>

<template>
  <NEmpty v-if="(schedules?.length ?? 0) == 0" />
  <NList>
    <NListItem v-for="item in schedules" v-bind:key="item.year + ' ' + item.week">
      <NGrid x-gap="12" :cols="7">
        <NGridItem v-for="(day, index) in item.days" v-bind:key="index">
          <NCard size="small" style="height: 100px; width: 100%">
            <template #header-extra>
              {{ day ? day.tag : '休息' }}
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
    </NListItem>
  </NList>
  <NGrid v-if="width > 1000"> </NGrid>
</template>
