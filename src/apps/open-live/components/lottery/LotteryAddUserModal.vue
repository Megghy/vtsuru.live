<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'

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
        <DialogTitle class="text-base font-semibold">手动添加用户</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-3 py-2 text-xs">
        <div class="flex items-center gap-3">
          <span class="w-20 text-muted-foreground shrink-0 text-right">
            <span class="text-destructive mr-0.5">*</span>用户名
          </span>
          <Input
            v-model="form.name"
            :disabled="disabled"
            placeholder="请输入用户名"
            class="text-xs h-8 flex-1"
          />
        </div>

        <div class="flex items-center gap-3">
          <span class="w-20 text-muted-foreground shrink-0 text-right">头像链接</span>
          <Input
            v-model="form.avatar"
            :disabled="disabled"
            placeholder="可选，留空则使用内置默认头像"
            class="text-xs h-8 flex-1"
          />
        </div>

        <div class="flex items-center gap-3">
          <span class="w-20 text-muted-foreground shrink-0 text-right">粉丝牌等级</span>
          <div class="w-[140px]">
            <NInputNumber
              v-model:value="form.fans_medal_level"
              size="small"
              :disabled="disabled"
              :min="0"
              :max="50"
            />
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="w-20 text-muted-foreground shrink-0 text-right">粉丝牌名称</span>
          <Input
            v-model="form.fans_medal_name"
            :disabled="disabled"
            placeholder="粉丝牌名称"
            class="text-xs h-8 flex-1"
          />
        </div>

        <div class="flex items-center gap-3">
          <span class="w-20 text-muted-foreground shrink-0 text-right">舰长等级</span>
          <div class="w-[140px]">
            <NInputNumber
              v-model:value="form.guard_level"
              size="small"
              :disabled="disabled"
              :min="0"
              :max="3"
            />
          </div>
        </div>
      </div>

      <DialogFooter class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="disabled"
          @click="showModel = false"
        >
          取消
        </Button>
        <Button
          size="sm"
          :disabled="disabled || !form.name"
          @click="submit"
        >
          添加用户
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
