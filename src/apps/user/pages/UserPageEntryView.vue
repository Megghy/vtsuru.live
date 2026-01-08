<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAlert, NButton, NResult, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { fetchUserPagesSettingsByUserId } from '@/features/user-page/api'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/features/user-page/types'
import { validateBlockPageProject } from '@/features/user-page/block/schema'
import BlockPageRenderer from '@/features/user-page/block/BlockPageRenderer.vue'
import ContribPageRenderer from '@/features/user-page/contrib/ContribPageRenderer.vue'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

const route = useRoute()
const userId = computed(() => props.userInfo?.id)
const pageSlug = computed(() => {
  const v = route.params.pageSlug
  return typeof v === 'string' && v.length ? v : undefined
})

const isLoading = ref(false)
const error = ref<string | null>(null)
const settings = ref<UserPagesSettingsV1 | null>(null)

async function loadSettings(id: number) {
  isLoading.value = true
  error.value = null
  settings.value = null
  try {
    settings.value = await fetchUserPagesSettingsByUserId(id)
  } catch (e) {
    error.value = (e as Error).message || String(e)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => userId.value,
  async (id) => {
    if (!id) return
    await loadSettings(id)
  },
  { immediate: true },
)

const pageConfig = computed<UserPageConfig | null>(() => {
  if (!settings.value) return null
  if (!pageSlug.value) return settings.value.home ?? null
  return settings.value.pages?.[pageSlug.value] ?? null
})

const renderMode = computed(() => {
  if (!pageSlug.value) return pageConfig.value?.mode ?? 'legacy'
  return pageConfig.value?.mode ?? null
})

const blockValidation = computed(() => {
  if (renderMode.value !== 'block') return null
  return validateBlockPageProject(pageConfig.value?.block)
})
</script>

<template>
  <NSpin :show="isLoading">
    <NAlert
      v-if="error"
      type="error"
      style="margin-bottom: 12px"
      :show-icon="true"
    >
      {{ error }}
    </NAlert>

    <DefaultIndexTemplate
      v-if="renderMode === 'legacy'"
      :user-info="userInfo"
      :bili-info="biliInfo"
    />

    <template v-else-if="renderMode === 'block'">
      <NResult
        v-if="blockValidation && !blockValidation.ok"
        status="error"
        title="页面配置错误"
        :description="blockValidation.errors.join('；')"
      />
      <BlockPageRenderer
        v-else-if="blockValidation && blockValidation.ok"
        :project="blockValidation.project"
        :user-info="userInfo"
        :bili-info="biliInfo"
      />
    </template>

    <ContribPageRenderer
      v-else-if="renderMode === 'contrib' && pageConfig?.contrib"
      :page="pageConfig.contrib"
      :user-info="userInfo"
      :bili-info="biliInfo"
    />

    <NResult
      v-else-if="pageSlug"
      status="404"
      title="页面不存在"
      description="该主播未配置此页面"
    >
      <template #footer>
        <NButton
          type="primary"
          @click="$router.push({ name: 'user-index', params: { id: route.params.id } })"
        >
          返回主页
        </NButton>
      </template>
    </NResult>
  </NSpin>
</template>

