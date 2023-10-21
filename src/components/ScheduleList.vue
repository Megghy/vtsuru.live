<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { NGrid, NList, NListItem, NSpace, NCard, NEmpty, NGridItem, NText, NTime, NButton, NPopconfirm, NEllipsis, NBadge } from 'naive-ui'
import { ref } from 'vue'
import { ScheduleWeekInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/data/constants'

const { width } = useWindowSize()

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
function getDateFromWeek(year: number, week: number, dayOfWeek: number): Date {
    // week starts from 1-52, dayOfWeek starts from 0-6 where 0 is Monday
    var simple = new Date(year, 0, 1 + (week - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return new Date(ISOweekStart.getFullYear(), ISOweekStart.getMonth(), ISOweekStart.getDate() + dayOfWeek);
}

defineProps<{
  schedules: ScheduleWeekInfo[],
  isSelf: boolean
}>()
const emit = defineEmits<{
  (e: 'onUpdate', schedule: ScheduleWeekInfo): void
  (e: 'onDelete', schedule: ScheduleWeekInfo): void
  (e: 'onCopy', schedule: ScheduleWeekInfo): void
}>()
</script>

<template>
  <NEmpty v-if="(schedules?.length ?? 0) == 0" />
  <NList style="padding: 0;" bordered >
    <NListItem v-for="item in schedules" v-bind:key="item.year + ' ' + item.week" style="padding: 0">
      <NCard size="small" :bordered="false">
        <template #header>
          <NText> {{ item.year }}年第{{ item.week }}周 </NText>
        </template>
        <template v-if="isSelf" #header-extra>
          <NSpace>
            <NButton size="small" @click="emit('onUpdate', item)"> 编辑 </NButton>
            <NButton size="small" @click="emit('onCopy', item)"> 复制 </NButton>
            <NPopconfirm @positive-click="emit('onDelete', item)">
              <template #trigger>
                <NButton size="small" type="error"> 删除 </NButton>
              </template>
              确定删除?
            </NPopconfirm>
          </NSpace>
        </template>
        <NGrid x-gap="8" cols="1 1000:7">
          <NGridItem v-for="(day, index) in item.days" v-bind:key="index">
            <NCard
              size="small"
              :style="{ height: '65px', backgroundColor: day.tagColor + '1f' }"
              content-style="padding: 5px;"
              header-style="padding: 0px 6px 0px 6px;"
              :embedded="day?.tag != undefined"
            >
              <template #header-extra>
                <template v-if="day.tag">
                  <NSpace :size="5">
                    <NBadge v-if="day.tagColor" dot :color="day.tagColor"/>
                    <NEllipsis>
                      <NText :style="{ color: day.tagColor }">
                        {{ day.tag }}
                      </NText>
                    </NEllipsis>
                  </NSpace>
                </template>
                <template v-else>
                  <NText depth="3" style="font-size: 11px" italic> 休息 </NText>
                </template>
              </template>
              <template #header>
                <NText :depth="3" style="font-size: 12px" strong :italic="!day.tag">
                  <NTime :time="getDateFromWeek(item.year, item.week, index)" format="MM/dd" />
                  {{ weekdays[index] }}
                  {{ day.time }}
                </NText>
              </template>
              <template v-if="day?.title">
                <NEllipsis>
                  <NText style="font-size: 13px">
                    {{ day.title }}
                  </NText>
                </NEllipsis>
              </template>
            </NCard>
          </NGridItem>
        </NGrid>
      </NCard>
    </NListItem>
  </NList>
  <NGrid v-if="width > 1000"> </NGrid>
</template>
