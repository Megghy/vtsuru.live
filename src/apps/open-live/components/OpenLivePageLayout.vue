<script setup lang="ts">
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

withDefaults(
  defineProps<{
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
  }>(),
  {
    showFunctionSwitch: false,
    enabled: false,
    switchLabel: '启用功能',
    loading: false,
    loginTipText: '你尚未注册并登录 VTsuru.live，部分功能和设置将不可用。',
  },
)

defineEmits<{
  (e: 'update:enabled', value: boolean): void
}>()
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <!-- ① 页头 -->
    <UCard
      size="small"
      bordered
    >
      <OpenLivePageHeader
        :title="title"
        :description="description"
      >
        <template
          v-if="$slots.actions"
          #footers
        >
          <slot name="actions" />
        </template>
      </OpenLivePageHeader>
    </UCard>

    <!-- ② 功能开关卡 (登录 + 启用了开关功能) -->
    <UCard
      v-if="isLoggedIn && showFunctionSwitch"
      size="small"
      bordered
    >
      <div
        align="center"
        justify="space-between"
        wrap
        :size="12"
      >
        <div
          align="center"
          wrap
          :size="10"
        >
          <span>{{ switchLabel }}</span>
          <USwitch
            size="small"
            :model-value="enabled"
            :loading="loading"
            @update:model-value="$emit('update:enabled', $event)"
          />
        </div>
      </div>
      <slot
        v-if="enabled"
        name="switch-extra"
      />
    </UCard>

    <!-- ②' 登录但无开关概念时, 仅渲染额外内容 (如点歌页的提示 Alert) -->
    <template v-else-if="isLoggedIn && $slots['switch-extra']">
      <slot name="switch-extra" />
    </template>

    <!-- ③ 未登录提示 -->
    <slot
      v-if="!isLoggedIn"
      name="login-tip"
    >
      <UAlert
        type="warning"
        size="small"
        :title="loginTipText"
        :bordered="false"
        closable
      >
        <UButton
          tag="a"
          href="/manage"
          target="_blank"
          color="primary"
          size="small"
        >
          前往登录或注册
        </UButton>
      </UAlert>
    </slot>

    <!-- ④ 主体 -->
    <slot />
  </div>
</template>
