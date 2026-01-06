<script setup lang="ts">
import type { ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NSpace } from 'naive-ui'
import { computed, reactive, watch } from 'vue'

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
  set: value => emit('update:show', value),
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
  <NModal
    v-model:show="showModel"
    preset="card"
    title="手动添加用户"
    style="max-width: 90%; width: 500px"
    closable
  >
    <NForm>
      <NFormItem label="用户名" required>
        <NInput v-model:value="form.name" :disabled="disabled" placeholder="请输入用户名" />
      </NFormItem>
      <NFormItem label="头像链接">
        <NInput v-model:value="form.avatar" :disabled="disabled" placeholder="请输入头像链接" />
      </NFormItem>
      <NSpace>
        <NFormItem label="粉丝牌等级">
          <NInputNumber v-model:value="form.fans_medal_level" :disabled="disabled" :min="0" :max="50" style="width: 120px" />
        </NFormItem>
        <NFormItem label="粉丝牌名称">
          <NInput v-model:value="form.fans_medal_name" :disabled="disabled" placeholder="粉丝牌名称" style="width: 150px" />
        </NFormItem>
      </NSpace>
      <NFormItem label="舰长等级">
        <NInputNumber v-model:value="form.guard_level" :disabled="disabled" :min="0" :max="3" style="width: 120px" />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton :disabled="disabled" @click="showModel = false">
          取消
        </NButton>
        <NButton type="primary" :disabled="disabled" @click="submit">
          添加用户
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

