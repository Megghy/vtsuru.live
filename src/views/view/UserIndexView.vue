<template>
  <component :is="indexType" :user-info="userInfo" :bili-info="biliInfo"/>
</template>

<script lang="ts" setup>
import { useUser } from '@/api/user'
import { IndexTypes } from '@/api/api-models'
import DefaultIndexTemplate from '@/views/view/indexTemplate/DefaultIndexTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
}>()

const indexType = computed(() => {
  if (userInfo.value) {
    switch (userInfo.value.indexType) {
      case IndexTypes.Default:
        return DefaultIndexTemplate

      default:
        return DefaultIndexTemplate
    }
  } else {
    return DefaultIndexTemplate
  }
})
const userInfo = ref<UserInfo>()

onMounted(async () => {
  userInfo.value = await useUser()
})
</script>
