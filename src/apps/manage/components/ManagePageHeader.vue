<script setup lang="ts">
import type { FunctionTypes } from '@/api/api-models'
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { useMessage, NFlex, NSpace, NSwitch, NText } from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  subtitle?: string
  functionType?: FunctionTypes // 如果不传，则不显示开关
  loading?: boolean
}>()

const accountInfo = useAccount()
const message = useMessage()
const switchLoading = ref(false)

async function setFunctionEnable(enable: boolean) {
  if (!props.functionType) return
  switchLoading.value = true
  try {
    const success = enable
      ? await EnableFunction(props.functionType)
      : await DisableFunction(props.functionType)

    if (success) {
      message.success(`${props.title}功能已${enable ? '启用' : '禁用'}`)
      // 更新本地状态
      if (accountInfo.value?.settings?.enableFunctions) {
        const list = accountInfo.value.settings.enableFunctions
        if (enable && !list.includes(props.functionType)) {
          list.push(props.functionType)
        } else if (!enable) {
          const index = list.indexOf(props.functionType)
          if (index > -1) list.splice(index, 1)
        }
      }
    } else {
      message.error(`无法${enable ? '启用' : '禁用'}${props.title}功能`)
    }
  } catch (err) {
    message.error(`操作失败: ${String(err)}`)
  } finally {
    switchLoading.value = false
  }
}
</script>

<template>
  <div class="manage-page-header">
    <NFlex class="manage-page-header__top" justify="space-between" align="flex-start" wrap :size="12">
      <div class="manage-page-header__titles">
        <h1 class="manage-page-header__title">
          {{ title }}
        </h1>
        <NText v-if="subtitle" depth="3" class="manage-page-header__subtitle">
          {{ subtitle }}
        </NText>
      </div>

      <NFlex class="manage-page-header__right" align="center" justify="end" wrap :size="10">
        <NFlex v-if="functionType && accountInfo" align="center" :size="8">
          <NText depth="3" class="manage-kicker">
            功能
          </NText>
          <NSwitch
            :value="accountInfo.settings?.enableFunctions?.includes(functionType)"
            :loading="switchLoading"
            :disabled="loading || switchLoading"
            @update:value="setFunctionEnable"
          >
            <template #checked>
              已启用
            </template>
            <template #unchecked>
              已禁用
            </template>
          </NSwitch>
        </NFlex>

        <NSpace class="manage-page-header__actions" :wrap="true">
          <slot name="action" />
        </NSpace>
      </NFlex>
    </NFlex>

    <div v-if="$slots.default" class="manage-page-header__below">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.manage-page-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manage-page-header__titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
}

.manage-page-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.manage-page-header__subtitle {
  font-size: 13px;
  line-height: 1.4;
}

.manage-page-header__right {
  flex: 1;
}

.manage-page-header__actions :deep(.n-button) {
  margin-left: 0;
}
</style>
