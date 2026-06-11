<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NSwitch, NText } from 'naive-ui';
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

withDefaults(defineProps<{
  title?: string
  description?: string
  isLoggedIn?: boolean
  /** 是否渲染功能开关卡 (点歌页无开关概念则关闭) */
  showFunctionSwitch?: boolean
  enabled?: boolean
  switchLabel?: string
  loading?: boolean
  /** 未登录提示文案 */
  loginTipText?: string
}>(), {
  showFunctionSwitch: false,
  enabled: false,
  switchLabel: '启用功能',
  loading: false,
  loginTipText: '你尚未注册并登录 VTsuru.live，部分功能和设置将不可用。',
})

defineEmits<{
  (e: 'update:enabled', value: boolean): void
}>()
</script>

<template>
  <NFlex vertical :size="12">
    <!-- ① 页头 -->
    <NCard size="small" bordered>
      <OpenLivePageHeader :title="title" :description="description">
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </OpenLivePageHeader>
    </NCard>

    <!-- ② 功能开关卡 (登录 + 启用了开关功能) -->
    <NCard v-if="isLoggedIn && showFunctionSwitch" size="small" bordered>
      <NFlex align="center" justify="space-between" wrap :size="12">
        <NFlex align="center" wrap :size="10">
          <NText>{{ switchLabel }}</NText>
          <NSwitch
            size="small"
            :value="enabled"
            :loading="loading"
            @update:value="$emit('update:enabled', $event)"
          />
        </NFlex>
      </NFlex>
      <slot v-if="enabled" name="switch-extra" />
    </NCard>

    <!-- ②' 登录但无开关概念时, 仅渲染额外内容 (如点歌页的提示 Alert) -->
    <template v-else-if="isLoggedIn && $slots['switch-extra']">
      <slot name="switch-extra" />
    </template>

    <!-- ③ 未登录提示 -->
    <slot v-if="!isLoggedIn" name="login-tip">
      <NAlert type="warning" size="small" :title="loginTipText" :bordered="false" closable>
        <NButton tag="a" href="/manage" target="_blank" type="primary" size="small">
          前往登录或注册
        </NButton>
      </NAlert>
    </slot>

    <!-- ④ 主体 -->
    <slot />
  </NFlex>
</template>
