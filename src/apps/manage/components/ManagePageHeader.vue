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
    message.error(`操作失败: ${err}`)
  } finally {
    switchLoading.value = false
  }
}
</script>

<template>
  <div style="margin-bottom: 16px;">
    <NFlex justify="space-between" align="center" wrap>
      <NSpace align="center" size="large">
        <div>
          <h2 style="margin: 0; font-weight: 500; line-height: 1.2;">
            {{ title }}
          </h2>
          <NText
            v-if="props.subtitle"
            depth="3"
            style="font-size: 12px; margin-top: 4px; display: block;"
          >
            {{ props.subtitle }}
          </NText>
        </div>
        <!-- 功能启用开关 -->
        <NFlex v-if="functionType && accountInfo" align="center" size="small">
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
      </NSpace>

      <!-- 右侧操作按钮插槽 -->
      <NSpace>
        <slot name="action" />
      </NSpace>
    </NFlex>
    
    <!-- 底部额外内容插槽 (如提示信息) -->
    <div style="margin-top: 12px;">
      <slot />
    </div>
  </div>
</template>
