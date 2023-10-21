<script setup lang="ts">
import { ScheduleWeekInfo, UserInfo } from '@/api/api-models';

defineProps<{
  userInfo: UserInfo | undefined
  currentData: ScheduleWeekInfo[] | undefined
}>()
</script>
<template>
  <div class="schedule-template pinky">
    <div v-for="item in currentData" :key="item.week">
      test
    </div>
  </div>
</template>

<style scoped>
.schedule-template pinky {
  background-color: #ebf0fa;
  background-image: linear-gradient(90deg, #ffffff 10%, rgba(0, 0, 0, 0) 10%), linear-gradient(#ffffff 10%, rgba(0, 0, 0, 0) 10%);
  background-size: 20px 20px;
}
</style>
