<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInputNumber, NSwitch, NText } from 'naive-ui'
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
  <NCard size="small" bordered title="悬浮小窗">
    <NFlex vertical :size="12">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" type="primary" @click="run(() => floatWindow.toggle())">
          {{ floatWindow.opened ? '关闭小窗' : '打开小窗' }}
        </NButton>
        <NText depth="3">
          独立无边框窗口，可置顶 + 穿透
        </NText>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="12">
        <NFlex align="center" :size="8">
          <NText depth="3">
            置顶
          </NText>
          <NSwitch
            v-model:value="floatWindow.settings.alwaysOnTop" size="small"
            @update:value="(v) => floatWindow.setSettings({ alwaysOnTop: v })"
          />
        </NFlex>
        <NFlex align="center" :size="8">
          <NText depth="3">
            穿透
          </NText>
          <NSwitch
            v-model:value="floatWindow.settings.clickThrough" size="small"
            @update:value="(v) => floatWindow.setSettings({ clickThrough: v })"
          />
        </NFlex>
        <NFlex align="center" :size="8">
          <NText depth="3">
            透明度
          </NText>
          <NInputNumber
            v-model:value="floatWindow.settings.opacity" :min="0.2" :max="1" :step="0.05" style="width: 120px"
            @update:value="(v) => floatWindow.setSettings({ opacity: Number(v) })"
          />
        </NFlex>
      </NFlex>

      <NAlert v-if="clickThroughHint" type="warning" :show-icon="false">
        {{ clickThroughHint }}
      </NAlert>
      <NAlert v-if="floatWindow.lastError" type="error" :show-icon="false">
        {{ floatWindow.lastError }}
      </NAlert>
    </NFlex>
  </NCard>
</template>
