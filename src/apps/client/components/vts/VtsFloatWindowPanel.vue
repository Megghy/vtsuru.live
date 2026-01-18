<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInputNumber, NSwitch, NText, useMessage } from 'naive-ui';
import { computed, onMounted } from 'vue'
import { useVtsFloatWindow } from '@/apps/client/store/useVtsFloatWindow'

const floatWindow = useVtsFloatWindow()
const message = useMessage()

onMounted(async () => {
  try {
    await floatWindow.init()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
})

const clickThroughHint = computed(() => {
  if (!floatWindow.settings.clickThrough) return ''
  return '已开启鼠标穿透：小窗内将无法点击操作，需要在主窗口关闭该开关。'
})

async function toggleWindow() {
  try {
    await floatWindow.toggle()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <NCard size="small" title="悬浮小窗（Tauri WebviewWindow）">
    <NFlex vertical :size="10">
      <NFlex align="center" :wrap="true" :size="8">
        <NButton size="small" type="primary" @click="toggleWindow">
          {{ floatWindow.opened ? '隐藏小窗' : '打开小窗' }}
        </NButton>
        <NText depth="3">
          路径：/vts-float-window（无边框/透明）。
        </NText>
      </NFlex>

      <NFlex align="center" :wrap="true" :size="12">
        <NFlex align="center" :wrap="true" :size="8">
          <NText depth="3">
            置顶
          </NText>
          <NSwitch
            v-model:value="floatWindow.settings.alwaysOnTop"
            size="small"
            @update:value="(v) => floatWindow.setSettings({ alwaysOnTop: v })"
          />
        </NFlex>
        <NFlex align="center" :wrap="true" :size="8">
          <NText depth="3">
            鼠标穿透
          </NText>
          <NSwitch
            v-model:value="floatWindow.settings.clickThrough"
            size="small"
            @update:value="(v) => floatWindow.setSettings({ clickThrough: v })"
          />
        </NFlex>
        <NFlex align="center" :wrap="true" :size="8">
          <NText depth="3">
            透明度
          </NText>
          <NInputNumber
            v-model:value="floatWindow.settings.opacity"
            :min="0.2"
            :max="1"
            :step="0.02"
            style="width: 140px"
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
