<script setup lang="ts">
import { ArrowUpCircle, Info, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'

import { checkUpdate, isCheckingUpdate } from '@/apps/client/data/initialize'
import type { ClientFeatureKey } from '@/shared/config/clientVersion'
import {
  checkClientFeature,
  checkClientMinVersion,
  CLIENT_FEATURES,
} from '@/shared/config/clientVersion'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

const props = withDefaults(
  defineProps<{
    feature?: ClientFeatureKey
    minVersion?: string
    title?: string
    description?: string
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const result = computed(() => {
  if (props.feature) return checkClientFeature(props.feature)
  return checkClientMinVersion(props.minVersion ?? '0.1.14', { label: props.title })
})

const displayTitle = computed(() => {
  if (props.title) return props.title
  if (props.feature) return CLIENT_FEATURES[props.feature].label
  return '需要更新客户端'
})

const displayDescription = computed(() => {
  if (props.description) return props.description
  if (result.value.reason === 'not-tauri') {
    return `此能力依赖桌面原生宿主，请在桌面客户端（≥ v${result.value.requiredVersion}）中使用。`
  }
  const featureDesc = props.feature ? `（${CLIENT_FEATURES[props.feature].description}）` : ''
  return `${result.value.message ?? ''}${featureDesc}`
})

function handleCheckUpdate() {
  void checkUpdate(true)
}
</script>

<template>
  <template v-if="!result.supported">
    <div
      v-if="compact"
      class="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <ArrowUpCircle
          v-if="result.isTauriEnv"
          class="size-3.5 shrink-0 text-amber-500"
        />
        <Info
          v-else
          class="size-3.5 shrink-0 text-muted-foreground"
        />
        <span class="truncate text-foreground">
          {{ displayTitle }}需客户端
          <span class="font-mono font-medium">≥ v{{ result.requiredVersion }}</span>
          <span
            v-if="result.currentVersion"
            class="text-muted-foreground"
          >（当前 v{{ result.currentVersion }}）</span>
        </span>
      </div>
      <Button
        v-if="result.isTauriEnv"
        variant="outline"
        size="xs"
        class="shrink-0"
        :disabled="isCheckingUpdate"
        @click="handleCheckUpdate"
      >
        <RefreshCw
          class="size-3 mr-1"
          :class="{ 'animate-spin': isCheckingUpdate }"
        />
        检查更新
      </Button>
    </div>

    <Alert
      v-else
      :variant="result.isTauriEnv ? 'warning' : 'info'"
    >
      <ArrowUpCircle
        v-if="result.isTauriEnv"
        class="size-4"
      />
      <Info
        v-else
        class="size-4"
      />
      <div class="flex items-start justify-between gap-3 w-full">
        <div class="min-w-0 space-y-1">
          <AlertTitle class="flex items-center gap-2 flex-wrap">
            <span>{{ displayTitle }}</span>
            <Badge
              variant="outline"
              class="font-mono text-[11px]"
            >
              需要 ≥ v{{ result.requiredVersion }}
            </Badge>
            <Badge
              v-if="result.currentVersion"
              variant="secondary"
              class="font-mono text-[11px]"
            >
              当前 v{{ result.currentVersion }}
            </Badge>
          </AlertTitle>
          <AlertDescription class="text-xs">
            {{ displayDescription }}
          </AlertDescription>
        </div>
        <Button
          v-if="result.isTauriEnv"
          variant="outline"
          size="xs"
          class="shrink-0"
          :disabled="isCheckingUpdate"
          @click="handleCheckUpdate"
        >
          <RefreshCw
            class="size-3 mr-1"
            :class="{ 'animate-spin': isCheckingUpdate }"
          />
          检查更新
        </Button>
      </div>
    </Alert>
  </template>
  <slot
    v-else
    :check="result"
  />
</template>
