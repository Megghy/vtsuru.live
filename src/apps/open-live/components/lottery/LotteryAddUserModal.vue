<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'

const props = defineProps<{
  show: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'submit', payload: ManualUserFormModel): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const form = reactive<ManualUserFormModel>({
  name: '',
  avatar: '',
  fans_medal_level: 0,
  fans_medal_name: '',
  guard_level: 0,
})

watch(
  () => props.show,
  (show) => {
    if (!show) return
    form.name = ''
    form.avatar = ''
    form.fans_medal_level = 0
    form.fans_medal_name = ''
    form.guard_level = 0
  },
)

function submit() {
  emit('submit', { ...form })
}
</script>

<template>
  <Dialog v-model:open="showModel">
    <DialogContent class="max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="text-base">手动添加用户</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2 text-xs">
        <FormField
          type="text"
          label="用户名"
          required
          :disabled="disabled"
          placeholder="请输入用户名"
          v-model="form.name"
        />

        <FormField
          type="text"
          label="头像链接"
          :disabled="disabled"
          placeholder="可选，留空则使用内置默认头像"
          v-model="form.avatar"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            type="number"
            label="粉丝牌等级"
            :disabled="disabled"
            :min="0"
            :max="50"
            v-model="form.fans_medal_level"
          />

          <FormField
            type="text"
            label="粉丝牌名称"
            :disabled="disabled"
            placeholder="粉丝牌名称"
            v-model="form.fans_medal_name"
          />
        </div>

        <FormField
          type="number"
          label="舰长等级"
          :disabled="disabled"
          :min="0"
          :max="3"
          v-model="form.guard_level"
        />
      </div>

      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          :disabled="disabled"
          @click="showModel = false"
        >
          取消
        </Button>
        <Button
          :disabled="disabled || !form.name"
          @click="submit"
        >
          添加用户
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
