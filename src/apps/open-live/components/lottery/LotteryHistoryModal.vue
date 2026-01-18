<script setup lang="ts">
import type { LotteryHistory } from '@/apps/open-live/components/lottery/lotteryTypes'
import { NButton, NCard, NEmpty, NList, NListItem, NModal, NScrollbar, NFlex, NTime, NAvatar } from 'naive-ui';
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
    style="width: 900px; max-width: 90vw"
    closable
  >
    <template #header-extra>
      <NButton type="error" secondary size="small" @click="emit('clear')">
        清空
      </NButton>
    </template>
    <NScrollbar v-if="history.length > 0" style="max-height: 80vh">
      <NList size="small" bordered>
        <NListItem v-for="item in history" :key="item.time">
          <NCard size="small" bordered>
            <template #header>
              <NTime :time="item.time" />
            </template>
            <template #header-extra>
              <NButton type="error" secondary size="small" @click="emit('remove', item.time)">
                删除
              </NButton>
            </template>
            <NFlex vertical :size="10">
              <NFlex v-for="user in item.users" :key="user.openId" align="center" :size="10">
                <NAvatar
                  round
                  lazy
                  :src="`${user.avatar}@64w_64h`"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                {{ user.name }}
              </NFlex>
            </NFlex>
          </NCard>
        </NListItem>
      </NList>
    </NScrollbar>
    <NEmpty v-else description="暂无记录" size="small" />
  </NModal>
</template>
