<script setup lang="ts">
import { AlertCircleOutline } from '@vicons/ionicons5'
import { computed, shallowRef, watch } from 'vue'
import type { Component } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Spin } from '@/shared/ui/spin'

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
  <div class="relative min-h-[120px]">
    <div
      v-if="isLoading"
      class="py-12 flex justify-center items-center"
    >
      <Spin />
    </div>
    <div
      v-else-if="error"
      class="p-6 max-w-md mx-auto"
    >
      <Alert variant="destructive">
        <component :is="AlertCircleOutline" class="size-4" />
        <AlertTitle>页面加载失败</AlertTitle>
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>
    <component
      :is="componentRef"
      v-else-if="componentRef"
      :user-info="userInfo"
      :bili-info="biliInfo"
      :page-config="pageConfig"
    />
  </div>
</template>
