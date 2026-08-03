<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useVtsFloatWindow } from '@/apps/client/store/useVtsFloatWindow'

import { useVtsAction } from './useVtsAction'

const floatWindow = useVtsFloatWindow()
const { run } = useVtsAction()

onMounted(() => run(() => floatWindow.init()))

const clickThroughHint = computed(() =>
  floatWindow.settings.clickThrough ? '鼠标穿透已开启，小窗内无法点击，需在此处关闭' : '',
)
</script>

<template>
  <UCard
    size="small"
    bordered
    title="悬浮小窗"
  >
    <div
      vertical
      :size="12"
    >
      <div
        align="center"
        :wrap="true"
        :size="8"
      >
        <UButton
          size="small"
          color="primary"
          @click="run(() => floatWindow.toggle())"
        >
          {{ floatWindow.opened ? '关闭小窗' : '打开小窗' }}
        </UButton>
        <span depth="3"> 独立无边框窗口，可置顶 + 穿透 </span>
      </div>

      <div
        align="center"
        :wrap="true"
        :size="12"
      >
        <div
          align="center"
          :size="8"
        >
          <span depth="3"> 置顶 </span>
          <USwitch
            v-model="floatWindow.settings.alwaysOnTop"
            size="small"
            @update:model-value="(v) => floatWindow.setSettings({ alwaysOnTop: v })"
          />
        </div>
        <div
          align="center"
          :size="8"
        >
          <span depth="3"> 穿透 </span>
          <USwitch
            v-model="floatWindow.settings.clickThrough"
            size="small"
            @update:model-value="(v) => floatWindow.setSettings({ clickThrough: v })"
          />
        </div>
        <div
          align="center"
          :size="8"
        >
          <span depth="3"> 透明度 </span>
          <UInputNumber
            v-model="floatWindow.settings.opacity"
            :min="0.2"
            :max="1"
            :step="0.05"
            style="width: 120px"
            @update:value="(v) => floatWindow.setSettings({ opacity: Number(v) })"
          />
        </div>
      </div>

      <UAlert
        v-if="clickThroughHint"
        type="warning"
        :show-icon="false"
      >
        {{ clickThroughHint }}
      </UAlert>
      <UAlert
        v-if="floatWindow.lastError"
        type="error"
        :show-icon="false"
      >
        {{ floatWindow.lastError }}
      </UAlert>
    </div>
  </UCard>
</template>
