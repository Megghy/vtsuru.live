<script setup lang="ts">
import type { Component } from 'vue'
import { NButton, NIcon, NTooltip } from 'naive-ui'

defineProps<{ icon: Component; tip: string; active?: boolean }>()
defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <NTooltip :delay="400">
    <template #trigger>
      <NButton
        quaternary
        size="tiny"
        :type="active ? 'primary' : 'default'"
        :aria-label="tip"
        @click="$emit('click', $event)"
      >
        <template #icon>
          <NIcon :component="icon" />
        </template>
      </NButton>
    </template>
    {{ tip }}
  </NTooltip>
</template>
