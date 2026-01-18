<script setup lang="ts">
import type { ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NFlex } from 'naive-ui';
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
    style="width: 520px; max-width: 90vw"
    closable
  >
    <NForm size="small" label-placement="left" label-width="80">
      <NFormItem label="用户名" required>
        <NInput v-model:value="form.name" size="small" :disabled="disabled" placeholder="请输入用户名" />
      </NFormItem>
      <NFormItem label="头像链接">
        <NInput v-model:value="form.avatar" size="small" :disabled="disabled" placeholder="请输入头像链接" />
      </NFormItem>
      <NFlex :wrap="true" :size="12">
        <NFormItem label="粉丝牌等级">
          <NInputNumber v-model:value="form.fans_medal_level" size="small" :disabled="disabled" :min="0" :max="50" class="lottery-add-user__narrow" />
        </NFormItem>
        <NFormItem label="粉丝牌名称">
          <NInput v-model:value="form.fans_medal_name" size="small" :disabled="disabled" placeholder="粉丝牌名称" class="lottery-add-user__medium" />
        </NFormItem>
      </NFlex>
      <NFormItem label="舰长等级">
        <NInputNumber v-model:value="form.guard_level" size="small" :disabled="disabled" :min="0" :max="3" class="lottery-add-user__narrow" />
      </NFormItem>
    </NForm>

    <template #footer>
      <NFlex justify="end">
        <NButton size="small" :disabled="disabled" @click="showModel = false">
          取消
        </NButton>
        <NButton type="primary" size="small" :disabled="disabled" @click="submit">
          添加用户
        </NButton>
      </NFlex>
    </template>
  </NModal>
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
