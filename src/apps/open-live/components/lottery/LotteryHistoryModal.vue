<script setup lang="ts">
import { computed } from 'vue'

import type { LotteryHistory } from '@/apps/open-live/components/lottery/lotteryTypes'

const props = defineProps<{
  show: boolean
  history: LotteryHistory[]
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'clear'): void
  (e: 'remove', time: number): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
</script>

<template>
  <UModal
    v-model:open="showModel"
    preset="card"
    title="抽奖结果"
    style="width: 900px; max-width: 90vw"
    closable
  >
    <template #header-extra>
      <UButton
        color="error"
        variant="soft"
        size="small"
        @click="emit('clear')"
      >
        清空
      </UButton>
    </template>
    <div
      v-if="history.length > 0"
      style="max-height: 80vh"
    >
      <ul
        size="small"
        bordered
      >
        <li
          v-for="item in history"
          :key="item.time"
        >
          <UCard
            size="small"
            bordered
          >
            <template #header>
              <time :time="item.time" />
            </template>
            <template #header-extra>
              <UButton
                color="error"
                variant="soft"
                size="small"
                @click="emit('remove', item.time)"
              >
                删除
              </UButton>
            </template>
            <div
              vertical
              :size="10"
            >
              <div
                v-for="user in item.users"
                :key="user.openId"
                align="center"
                :size="10"
              >
                <UAvatar
                  round
                  lazy
                  :src="`${user.avatar}@64w_64h`"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                {{ user.name }}
              </div>
            </div>
          </UCard>
        </li>
      </ul>
    </div>
    <UEmpty
      v-else
      description="暂无记录"
      size="small"
    />
  </UModal>
</template>
