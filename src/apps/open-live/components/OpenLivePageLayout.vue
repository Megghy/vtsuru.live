<script setup lang="ts">
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'

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
  <div class="flex flex-col gap-3">
    <!-- ① 页头 -->
    <Card class="p-3">
      <OpenLivePageHeader
        :title="title"
        :description="description"
      >
        <template
          v-if="$slots.actions"
          #actions
        >
          <slot name="actions" />
        </template>
      </OpenLivePageHeader>
    </Card>

    <!-- ② 功能开关卡 (登录 + 启用了开关功能) -->
    <Card
      v-if="isLoggedIn && showFunctionSwitch"
      class="p-3"
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2.5">
          <span class="text-sm font-medium">{{ switchLabel }}</span>
          <Switch
            :checked="enabled"
            :disabled="loading"
            @update:checked="$emit('update:enabled', $event)"
          />
        </div>
      </div>
      <slot
        v-if="enabled"
        name="switch-extra"
      />
    </Card>

    <!-- ②' 登录但无开关概念时, 仅渲染额外内容 (如点歌页的提示 Alert) -->
    <template v-else-if="isLoggedIn && $slots['switch-extra']">
      <slot name="switch-extra" />
    </template>

    <!-- ③ 未登录提示 -->
    <slot
      v-if="!isLoggedIn"
      name="login-tip"
    >
      <Alert class="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between">
        <div>
          <AlertTitle class="text-xs font-semibold text-amber-800 dark:text-amber-300">{{ loginTipText }}</AlertTitle>
        </div>
        <Button
          as="a"
          href="/manage"
          target="_blank"
          class="ml-auto"
        >
          前往登录或注册
        </Button>
      </Alert>
    </slot>

    <!-- ④ 主体 -->
    <slot />
  </div>
</template>
