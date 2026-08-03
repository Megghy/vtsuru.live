<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'

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
  avatar: 'https://i2.hdslb.com/bfs/face/member/noface.jpg',
  fans_medal_level: 0,
  fans_medal_name: '',
  guard_level: 0,
})

watch(
  () => props.show,
  (show) => {
    if (!show) return
    form.name = ''
    form.avatar = 'https://i2.hdslb.com/bfs/face/member/noface.jpg'
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
  <UModal
    v-model:open="showModel"
    preset="card"
    title="手动添加用户"
    style="width: 520px; max-width: 90vw"
    closable
  >
    <UForm
      size="small"
      label-placement="left"
      label-width="80"
    >
      <UFormField
        label="用户名"
        required
      >
        <UInput
          v-model="form.name"
          size="small"
          :disabled="disabled"
          placeholder="请输入用户名"
        />
      </UFormField>
      <UFormField label="头像链接">
        <UInput
          v-model="form.avatar"
          size="small"
          :disabled="disabled"
          placeholder="请输入头像链接"
        />
      </UFormField>
      <div
        :wrap="true"
        :size="12"
      >
        <UFormField label="粉丝牌等级">
          <UInputNumber
            v-model="form.fans_medal_level"
            size="small"
            :disabled="disabled"
            :min="0"
            :max="50"
            class="lottery-add-user__narrow"
          />
        </UFormField>
        <UFormField label="粉丝牌名称">
          <UInput
            v-model="form.fans_medal_name"
            size="small"
            :disabled="disabled"
            placeholder="粉丝牌名称"
            class="lottery-add-user__medium"
          />
        </UFormField>
      </div>
      <UFormField label="舰长等级">
        <UInputNumber
          v-model="form.guard_level"
          size="small"
          :disabled="disabled"
          :min="0"
          :max="3"
          class="lottery-add-user__narrow"
        />
      </UFormField>
    </UForm>

    <template #footer>
      <div justify="end">
        <UButton
          size="small"
          :disabled="disabled"
          @click="showModel = false"
        >
          取消
        </UButton>
        <UButton
          color="primary"
          size="small"
          :disabled="disabled"
          @click="submit"
        >
          添加用户
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.lottery-add-user__narrow {
  width: 140px;
}

.lottery-add-user__medium {
  width: 220px;
  max-width: 100%;
}
</style>
