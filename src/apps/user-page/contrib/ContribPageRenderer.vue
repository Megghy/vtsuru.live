<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NResult, NSpin } from 'naive-ui'
import { computed, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import type { ContribPageRef } from '../types'
import { getContribPageImporter } from './registry'

const props = defineProps<{
  page: ContribPageRef
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
}>()

const componentRef = shallowRef<Component | null>(null)
const isLoading = shallowRef(false)
const error = shallowRef<string | null>(null)

const pageConfig = computed(() => props.page.config)

watch(
  () => [props.page.scope, props.page.pageId, props.page.streamerId] as const,
  async () => {
    error.value = null
    componentRef.value = null
    isLoading.value = true
    try {
      const importer = getContribPageImporter(props.page)
      const mod: any = await importer()
      if (!mod?.default) throw new Error('Contrib Page 缺少 default export')
      componentRef.value = mod.default as Component
    } catch (e) {
      error.value = (e as Error).message || String(e)
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <NSpin :show="isLoading">
    <NResult
      v-if="error"
      status="error"
      title="页面加载失败"
      :description="error"
    />
    <component
      :is="componentRef"
      v-else-if="componentRef"
      :user-info="userInfo"
      :bili-info="biliInfo"
      :page-config="pageConfig"
    />
  </NSpin>
</template>

