<script setup lang="ts">
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import Save24Regular from '@vicons/fluent/es/Save24Regular'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

withDefaults(
  defineProps<{
    isDirty: boolean
    isSaving?: boolean
    canEdit?: boolean
    dirtyTitle?: string
    dirtyHint?: string
    cleanHint?: string
  }>(),
  {
    isSaving: false,
    canEdit: true,
    dirtyTitle: '设置存在未保存的更改',
    dirtyHint: '请及时保存，避免切页或刷新丢失',
    cleanHint: '所有规则修改后统一点击「保存设置」生效。',
  },
)

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div
    v-if="isDirty"
    class="sticky top-2 z-20 flex-between gap-3 flex-wrap rounded-lg border border-amber-500/40 bg-background/95 backdrop-blur-md px-3.5 py-2.5 shadow-sm"
  >
    <div class="flex items-center gap-2 text-xs">
      <span class="size-2 rounded-full bg-amber-500 shrink-0" />
      <span class="font-medium text-foreground">{{ dirtyTitle }}</span>
      <span class="text-muted-foreground hidden sm:inline">{{ dirtyHint }}</span>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        :disabled="isSaving"
        @click="emit('reset')"
      >
        <ArrowReset24Regular class="size-3.5 mr-1" />
        还原更改
      </Button>
      <Button
        :loading="isSaving"
        :disabled="!canEdit"
        @click="emit('save')"
      >
        <Save24Regular class="size-3.5 mr-1" />
        保存设置
      </Button>
    </div>
  </div>

  <Alert
    v-else
    size="sm"
    class="bg-muted/40 border-border/80"
  >
    <AlertDescription class="text-muted-foreground">
      {{ cleanHint }}
    </AlertDescription>
  </Alert>
</template>
