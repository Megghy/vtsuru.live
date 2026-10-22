<script setup lang="ts">
// @ts-expect-error Markdown files are compiled as Vue components by the Vite plugin.
import UserAgreement from '@/content/agreements/UserAgreement.md'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'

const show = defineModel<boolean>('show', { required: true })
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col p-6">
      <DialogHeader>
        <DialogTitle>用户协议</DialogTitle>
      </DialogHeader>
      <ScrollArea class="flex-1 max-h-[60vh] pr-4">
        <div class="prose prose-sm dark:prose-invert">
          <UserAgreement />
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
