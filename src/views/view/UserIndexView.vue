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

const componentType = computed(() => {
  const type = props.template ?? props.userInfo?.extra?.templateTypes['index']?.toLowerCase()
  if (props.userInfo) {
    switch (type?.toLocaleLowerCase()) {
      case '':
        return DefaultIndexTemplate

      default:
        return DefaultIndexTemplate
    }
  } else {
    return DefaultIndexTemplate
  }
})
</script>
