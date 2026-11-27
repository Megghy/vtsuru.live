<script setup lang="ts">
import { ref, watch } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Textarea } from '@/shared/ui/textarea'

const QUICK_REASONS = ['与本期主题不符', '视频时长或画质不合适', '内容重复', '存在版权或直播风险']

const props = defineProps<{
  open: boolean
  count: number
  targetTitle?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [reason: string]
}>()

const reason = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = ''
  },
)

function handleConfirm() {
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ count > 1 ? `批量拒绝 ${count} 个视频` : '拒绝该投稿' }}</DialogTitle>
        <DialogDescription>
          {{ targetTitle ? `视频：${targetTitle}` : '可选填写拒绝理由，已绑定 B 站的投稿观众可在投稿页查看状态与理由。' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-1">
        <div class="flex flex-wrap gap-1.5">
          <Badge
            v-for="preset in QUICK_REASONS"
            :key="preset"
            variant="outline"
            size="xs"
            class="cursor-pointer hover:bg-muted transition-colors"
            @click="reason = preset"
          >
            {{ preset }}
          </Badge>
        </div>

        <FormField
          label="拒绝理由（选填）"
          :extra="`${reason.length}/100`"
        >
          <Textarea
            v-model="reason"
            rows="3"
            maxlength="100"
            placeholder="留空则直接拒绝，不附带理由"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          :disabled="loading"
          @click="emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          :loading="loading"
          @click="handleConfirm"
        >
          确认拒绝
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
