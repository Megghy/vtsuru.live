<script setup lang="ts">
import type { LotteryHistory } from '@/apps/open-live/components/lottery/lotteryTypes'
import { NButton, NCard, NEmpty, NList, NListItem, NModal, NScrollbar, NSpace, NTime, NAvatar } from 'naive-ui'
import { computed } from 'vue'

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
  set: value => emit('update:show', value),
})
</script>

<template>
  <NModal
    v-model:show="showModel"
    preset="card"
    title="抽奖结果"
    style="max-width: 90%; width: 800px"
    closable
  >
    <template #header-extra>
      <NButton type="error" size="small" @click="emit('clear')">
        清空
      </NButton>
    </template>
    <NScrollbar v-if="history.length > 0" style="max-height: 80vh">
      <NList>
        <NListItem v-for="item in history" :key="item.time">
          <NCard size="small">
            <template #header>
              <NTime :time="item.time" />
            </template>
            <template #header-extra>
              <NButton type="error" size="small" @click="emit('remove', item.time)">
                删除
              </NButton>
            </template>
            <NSpace vertical>
              <NSpace v-for="user in item.users" :key="user.openId">
                <NAvatar
                  round
                  lazy
                  :src="`${user.avatar}@64w_64h`"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                {{ user.name }}
              </NSpace>
            </NSpace>
          </NCard>
        </NListItem>
      </NList>
    </NScrollbar>
    <NEmpty v-else description="暂无记录" />
  </NModal>
</template>

