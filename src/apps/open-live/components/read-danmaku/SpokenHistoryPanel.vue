<script setup lang="ts">
import { NEmpty, NScrollbar, NText, NTime } from 'naive-ui'
import { useSpeechService } from '@/store/useSpeechService'

const { spokenHistory } = useSpeechService()
</script>

<template>
  <div class="history">
    <div class="header">
      <NText strong style="font-size: 13px">
        已播报
      </NText>
      <NText depth="3" style="font-size: 11px">
        最近 {{ spokenHistory.length }} 条
      </NText>
    </div>
    <NEmpty v-if="spokenHistory.length === 0" description="暂无记录" size="small" />
    <NScrollbar v-else style="max-height: 260px">
      <div class="items">
        <div v-for="(item, i) in spokenHistory" :key="i" class="item">
          <span class="uname">{{ item.uname }}</span>
          <NText depth="3" class="text">
            {{ item.text }}
          </NText>
          <NTime :time="item.time" type="relative" class="time" />
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.history { display: flex; flex-direction: column; gap: 6px; }
.header { display: flex; align-items: center; gap: 8px; }
.items { display: flex; flex-direction: column; gap: 2px; }
.item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; font-size: 11px; border-radius: 4px;
}
.item:hover { background: var(--n-color-target, rgba(0,0,0,0.03)); }
.uname { font-weight: 500; flex-shrink: 0; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.time { flex-shrink: 0; font-size: 10px; color: var(--n-text-color-3); }
</style>
