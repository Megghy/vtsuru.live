<template>
  <component :is="indexType" :user-info="userInfo" :bili-info="biliInfo"/>
</template>

<script lang="ts" setup>
import { IndexTypes } from '@/api/api-models'
import DefaultIndexTemplate from '@/views/view/indexTemplate/DefaultIndexTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'

const { biliInfo, userInfo } = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

const indexType = computed(() => {
  if (userInfo) {
    switch (userInfo.indexType) {
      case IndexTypes.Default:
        return DefaultIndexTemplate

      default:
        return DefaultIndexTemplate
    }
  } else {
    return DefaultIndexTemplate
  }
})
</script>
