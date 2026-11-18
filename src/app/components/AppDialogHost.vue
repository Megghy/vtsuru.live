<script setup lang="ts">
import type { VNode } from 'vue'
import { computed, ref, watch } from 'vue'

import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { appDialog, shiftAppDialog, toast } from '@/shared/utils'

const isSubmitting = ref(false)

watch(appDialog, () => {
  isSubmitting.value = false
})

const open = computed({
  get: () => appDialog.value != null,
  set: (value) => {
    if (!value && !isSubmitting.value) void close('dismiss')
  },
})

const resolvedContent = computed(() => {
  const content = appDialog.value?.content
  if (typeof content === 'function') return { render: content as () => VNode }
  if (typeof content === 'object' && content) return content
  return null
})

async function close(reason: 'positive' | 'negative' | 'dismiss') {
  const current = appDialog.value
  if (!current || isSubmitting.value) return

  if (reason === 'positive' && current.onPositiveClick) {
    isSubmitting.value = true
    try {
      const result = await current.onPositiveClick()
      if (result === false) return
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return
    } finally {
      isSubmitting.value = false
    }
  } else if (reason === 'negative') {
    current.onNegativeClick?.()
  }

  shiftAppDialog()
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
          :disabled="isSubmitting"
          @click="close('negative')"
        >
          {{ appDialog.negativeText }}
        </Button>
        <Button
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="close('positive')"
        >
          {{ appDialog?.positiveText || '确定' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
