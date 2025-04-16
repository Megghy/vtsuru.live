<template>
  <div>
    <component
      :is="componentType"
      :user-info="userInfo"
      :bili-info="biliInfo"
    />
  </div>
</template>

<script lang="ts" setup>
import { UserInfo } from '@/api/api-models'
import DefaultIndexTemplate from '@/views/view/indexTemplate/DefaultIndexTemplate.vue'
import { computed } from 'vue'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
}>()

// 计算要展示的模板组件
const componentType = computed(() => {
  // 获取模板类型：优先使用传入的template，其次使用用户配置，默认为空字符串
  const type = props.template ?? props.userInfo?.extra?.templateTypes['index']?.toLowerCase() ?? ''

  // 无论用户信息是否存在，始终返回默认模板
  // 这里预留了根据不同类型返回不同模板的扩展性
  return DefaultIndexTemplate
})
</script>
