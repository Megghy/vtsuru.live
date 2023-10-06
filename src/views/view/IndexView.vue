<template>
  <div style="display: flex; justify-content: center">
    <div>
      <NText strong tag="h1"> vtsuru </NText>
      <component :is="indexType" :user-info="userInfo"/>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useAccount } from '@/api/account'
import { useUser } from '@/api/user'
import { IndexTypes } from '@/api/api-models'
import { NButton, NText } from 'naive-ui'
import DefaultIndexTemplate from '@/views/view/indexTemplate/DefaultIndexTemplate.vue'
import { computed } from 'vue'

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
const accountInfo = useAccount()
const userInfo = await useUser()
</script>
