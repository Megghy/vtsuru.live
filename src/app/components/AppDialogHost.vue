<script setup lang="ts">
import type { VNode } from 'vue'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { appDialog } from '@/shared/utils'

const open = computed({
  get: () => appDialog.value != null,
  set: (value) => {
    if (!value) close('dismiss')
  },
})

const resolvedContent = computed(() => {
  const content = appDialog.value?.content
  if (typeof content === 'function') return { render: content as () => VNode }
  if (typeof content === 'object' && content) return content
  return null
})

function close(reason: 'positive' | 'negative' | 'dismiss') {
  const current = appDialog.value
  if (!current) return
  appDialog.value = null
  if (reason === 'positive') void current.onPositiveClick?.()
  else if (reason === 'negative') current.onNegativeClick?.()
  current.onClose?.()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :class="appDialog?.class ?? 'sm:max-w-md'">
      <DialogHeader>
        <DialogTitle class="text-base">{{ appDialog?.title }}</DialogTitle>
      </DialogHeader>
      <component
        :is="resolvedContent"
        v-if="resolvedContent"
      />
      <p
        v-else-if="appDialog?.content"
        class="text-sm text-muted-foreground whitespace-pre-wrap"
      >
        {{ appDialog.content }}
      </p>
      <DialogFooter>
        <Button
          v-if="appDialog?.negativeText"
          variant="outline"
          @click="close('negative')"
        >
          {{ appDialog.negativeText }}
        </Button>
        <Button @click="close('positive')">
          {{ appDialog?.positiveText || '确定' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
