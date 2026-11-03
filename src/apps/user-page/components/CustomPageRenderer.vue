<script setup lang="ts">
import { computed, watch } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'

import CustomHtmlBlock from '../block/blocks/CustomHtmlBlock.vue'
import type { CustomHtmlProps } from '../block/customHtmlContract'
import { validateCustomHtmlConfig } from '../block/customHtmlValidation'
import { reportPublicPageError } from '../runtime/observability'
import type { BiliProfile } from '../types'

const props = defineProps<{
  config?: CustomHtmlProps
  pageSlug?: string | null
  userInfo?: ResponseUserInfo
  biliInfo?: BiliProfile
}>()
const issues = computed(() => validateCustomHtmlConfig(props.config))
watch(
  issues,
  (value) => {
    if (value.length) reportPublicPageError(new Error(value.map((issue) => issue.message).join('; ')), 'render')
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="issues.length"
    class="flex-col-center p-12 text-center"
  >
    <div class="text-destructive font-semibold text-lg mb-2">页面配置错误</div>
    <div class="text-sm text-muted-foreground">该页面的发布配置无效，请联系页面所有者处理</div>
  </div>
  <CustomHtmlBlock
    v-else
    :block-props="config"
    :page-slug="pageSlug"
    :user-info="userInfo"
    :bili-info="biliInfo"
    page-mode="custom"
  />
</template>
