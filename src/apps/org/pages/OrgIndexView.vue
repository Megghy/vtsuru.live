<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/shared/config'
import { showErrorToast, showSuccessToast, showWarningToast } from '@/shared/services/toast'

import '@/apps/org/styles/org-page.css'
import type { OrgInfoModel } from '../types'
import { roleLabel, roleTagType } from '../utils'

const router = useRouter()

const isLoading = ref(false)
const orgs = ref<OrgInfoModel[]>([])

const showCreateModal = ref(false)
const creating = ref(false)
const orgName = ref('')

async function loadMyOrgs() {
  if (!isLoggedIn.value) return
  isLoading.value = true
  try {
    orgs.value = unwrapOk(await QueryGetAPI<OrgInfoModel[]>(`${ORG_API_URL}my`), '加载失败')
  } catch (err) {
    showErrorToast(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

async function createOrg() {
  if (creating.value) return
  const name = orgName.value.trim()
  if (!name) {
    showWarningToast('请输入组织名称')
    return
  }
  creating.value = true
  try {
    unwrapOk(await QueryPostAPI(`${ORG_API_URL}create`, { name }), '创建失败')
    showSuccessToast('创建成功')
    orgName.value = ''
    showCreateModal.value = false
    await loadMyOrgs()
  } catch (err) {
    showErrorToast(err instanceof Error ? err.message : '创建失败')
  } finally {
    creating.value = false
  }
}

function openOrg(orgId: number) {
  router.push({ name: 'org-detail', params: { orgId } })
}

function handleGoConsole() {
  router.push({ name: 'manage-index' })
}

onMounted(loadMyOrgs)

watch(
  () => isLoggedIn.value,
  async (loggedIn) => {
    if (!loggedIn) {
      orgs.value = []
      return
    }
    await loadMyOrgs()
  },
  { immediate: true },
)
</script>

<template>
  <div class="org-page org-page--index">
    <template v-if="!isLoggedIn">
      <section class="login-panel">
        <h1>组织管理</h1>
        <UAlert
          color="warning"
          icon="i-lucide-triangle-alert"
          title="需要先登录才能查看或创建组织"
        />
        <RegisterAndLogin />
      </section>
    </template>

    <template v-else>
      <header class="org-header">
        <div>
          <p>ORGANIZATIONS</p>
          <h1>组织管理</h1>
        </div>
        <div class="header-actions">
          <UButton
            color="neutral"
            variant="soft"
            @click="handleGoConsole"
          >
            返回控制台
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="isLoading"
            @click="loadMyOrgs"
          >
            刷新
          </UButton>
          <UButton
            icon="i-lucide-plus"
            @click="showCreateModal = true"
          >
            创建组织
          </UButton>
        </div>
      </header>

      <div style="margin-top: 24px">
        <div v-if="isLoading && orgs.length === 0">
          <div class="org-grid">
            <div
              v-for="i in 4"
              :key="i"
              class="org-card skeleton-card"
            >
              <USkeleton class="skeleton-icon" />
              <USkeleton class="skeleton-title" />
              <USkeleton class="skeleton-line" />
              <USkeleton class="skeleton-button" />
            </div>
          </div>
        </div>

        <template v-else-if="orgs.length === 0">
          <UEmpty
            icon="i-lucide-building-2"
            title="暂无组织"
            description="创建一个组织开始协作。"
          >
            <template #extra>
              <UButton @click="showCreateModal = true"> 创建组织 </UButton>
            </template>
          </UEmpty>
        </template>

        <div
          v-else
          class="org-grid"
        >
          <button
            v-for="org in orgs"
            :key="org.id"
            type="button"
            class="org-card"
            @click="openOrg(org.id)"
          >
            <div class="card-top">
              <UIcon name="i-lucide-building-2" />
              <UBadge
                :color="roleTagType(org.role) === 'default' ? 'neutral' : roleTagType(org.role)"
                variant="soft"
                size="small"
              >
                {{ roleLabel(org.role) }}
              </UBadge>
            </div>

            <div style="margin-top: 12px">
              <div
                style="font-weight: 600; font-size: 16px; margin-bottom: 4px"
                class="text-ellipsis"
              >
                {{ org.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.6">ID: {{ org.id }}</div>
            </div>

            <div style="margin-top: 16px; text-align: right">
              <UButton
                block
                variant="soft"
                trailing-icon="i-lucide-arrow-right"
              >
                进入管理
              </UButton>
            </div>
          </button>
        </div>
      </div>

      <!-- 创建组织模态框 -->
      <UModal
        v-model:open="showCreateModal"
        title="创建新组织"
        :ui="{ content: 'sm:max-w-md' }"
      >
        <template #body>
          <form
            id="create-org-form"
            @submit.prevent="createOrg"
          >
            <UFormField label="组织名称">
              <UInput
                v-model="orgName"
                placeholder="请输入组织名称"
                autofocus
              />
            </UFormField>
          </form>
        </template>
        <template #footer>
          <div class="modal-actions">
            <UButton
              color="neutral"
              variant="ghost"
              @click="showCreateModal = false"
            >
              取消
            </UButton>
            <UButton
              type="submit"
              form="create-org-form"
              :loading="creating"
            >
              创建
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>

<style scoped>
.login-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

.login-panel h1 {
  margin: 0;
}

.org-header,
.header-actions,
.card-top,
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.org-header p,
.org-header h1 {
  margin: 0;
}

.org-header p {
  color: var(--vtsuru-brand);
  font-size: 12px;
  font-weight: 700;
}

.org-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.org-card {
  display: block;
  height: 100%;
  padding: 16px;
  color: var(--vtsuru-fg);
  text-align: left;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  cursor: pointer;
}
.org-card:hover {
  border-color: var(--vtsuru-brand);
}

.card-top > .iconify {
  color: var(--vtsuru-brand);
  font-size: 32px;
}

.skeleton-card {
  display: grid;
  gap: 12px;
  cursor: default;
}

.skeleton-icon {
  width: 32px;
  height: 32px;
}

.skeleton-title {
  width: 60%;
  height: 18px;
}

.skeleton-line {
  width: 40%;
  height: 12px;
}

.skeleton-button {
  width: 100%;
  height: 32px;
}

.modal-actions {
  justify-content: flex-end;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .org-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
