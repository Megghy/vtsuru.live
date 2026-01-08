<script setup lang="ts">
import {
  AddOutline,
  ArrowForward,
  BusinessOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NModal,
  NPageHeader,
  NSpace,
  NSkeleton,
  NTag,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch  } from 'vue'

import { useRouter } from 'vue-router'
import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/shared/config'

interface OrgInfoModel {
  id: number
  name: string
  ownerUserId: number
  role: number
}

interface CreateOrgResponse {
  id: number
  name: string
  ownerUserId: number
  role: number
}

const router = useRouter()
const message = useMessage()

const isLoading = ref(false)
const orgs = ref<OrgInfoModel[]>([])

const showCreateModal = ref(false)
const creating = ref(false)
const orgName = ref('')

const roleLabel = computed(() => {
  return (role: number) => {
    if (role === 0) return 'Owner'
    if (role === 1) return 'Admin'
    return 'Member'
  }
})

function roleType(role: number): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (role === 0) return 'success' // Owner
  if (role === 1) return 'info'    // Admin
  return 'default'                 // Member
}

async function loadMyOrgs() {
  if (!isLoggedIn.value) return
  isLoading.value = true
  try {
    const resp = await QueryGetAPI<OrgInfoModel[]>(`${ORG_API_URL}my`)
    if (resp.code === 200) {
      orgs.value = resp.data
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

async function createOrg() {
  if (creating.value) return
  const name = orgName.value.trim()
  if (!name) {
    message.warning('请输入组织名称')
    return
  }

  creating.value = true
  try {
    const resp = await QueryPostAPI<CreateOrgResponse>(`${ORG_API_URL}create`, { name })
    if (resp.code === 200) {
      message.success('创建成功')
      orgName.value = ''
      showCreateModal.value = false
      await loadMyOrgs()
      // Optional: Redirect immediately
      // router.push({ name: 'org-detail', params: { orgId: resp.data.id } })
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '创建失败')
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

onMounted(() => {
  loadMyOrgs()
})

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
  <div style="max-width: 1200px; margin: 0 auto; padding: 16px;">
    <template v-if="!isLoggedIn">
      <NCard title="组织管理">
        <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
          需要先登录才能查看/创建组织。
        </NAlert>
        <RegisterAndLogin />
      </NCard>
    </template>

    <template v-else>
      <NPageHeader @back="handleGoConsole">
        <template #title>
          组织管理
        </template>
        <template #extra>
          <NSpace>
            <NButton secondary @click="handleGoConsole">
              返回控制台
            </NButton>
            <NButton :loading="isLoading" @click="loadMyOrgs">
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              刷新
            </NButton>
            <NButton type="primary" @click="showCreateModal = true">
              <template #icon>
                <NIcon :component="AddOutline" />
              </template>
              创建组织
            </NButton>
          </NSpace>
        </template>
      </NPageHeader>

      <div style="margin-top: 24px;">
        <div v-if="isLoading && orgs.length === 0">
          <NGrid :x-gap="16" :y-gap="16" cols="1 600:2 900:3 1200:4" item-responsive>
            <NGridItem v-for="i in 4" :key="i">
              <NCard class="org-card" content-style="padding: 16px;">
                <NSpace justify="space-between" align="start">
                  <NSkeleton :width="32" :height="32" :sharp="false" />
                  <NSkeleton :width="60" :height="22" :sharp="false" />
                </NSpace>
                <div style="margin-top: 12px;">
                  <NSkeleton text style="width: 60%; margin-bottom: 4px;" />
                  <NSkeleton text style="width: 40%; font-size: 12px;" />
                </div>
                <div style="margin-top: 16px; text-align: right;">
                  <NSkeleton width="100%" :height="28" :sharp="false" />
                </div>
              </NCard>
            </NGridItem>
          </NGrid>
        </div>

        <template v-else-if="orgs.length === 0">
          <NEmpty description="暂无组织，创建一个吧！" style="margin-top: 40px;">
            <template #extra>
              <NButton type="primary" @click="showCreateModal = true">
                创建组织
              </NButton>
            </template>
          </NEmpty>
        </template>

        <NGrid v-else :x-gap="16" :y-gap="16" cols="1 600:2 900:3 1200:4" item-responsive>
          <NGridItem v-for="org in orgs" :key="org.id">
            <NCard
              hoverable
              content-style="padding: 16px;"
              class="org-card"
              @click="openOrg(org.id)"
            >
              <NSpace justify="space-between" align="start">
                <NIcon size="32" color="var(--n-primary-color)" :component="BusinessOutline" />
                <NTag :bordered="false" :type="roleType(org.role)" size="small">
                  {{ roleLabel(org.role) }}
                </NTag>
              </NSpace>

              <div style="margin-top: 12px;">
                <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;" class="text-ellipsis">
                  {{ org.name }}
                </div>
                <div style="font-size: 12px; opacity: 0.6;">
                  ID: {{ org.id }}
                </div>
              </div>

              <div style="margin-top: 16px; text-align: right;">
                <NButton size="small" secondary type="primary" style="width: 100%;">
                  进入管理
                  <template #icon>
                    <NIcon :component="ArrowForward" />
                  </template>
                </NButton>
              </div>
            </NCard>
          </NGridItem>
        </NGrid>
      </div>

      <!-- 创建组织模态框 -->
      <NModal
        v-model:show="showCreateModal"
        preset="card"
        title="创建新组织"
        style="width: 400px; max-width: 90vw;"
      >
        <NForm @submit.prevent="createOrg">
          <NFormItem label="组织名称" :show-feedback="false">
            <NInput
              v-model:value="orgName"
              placeholder="请输入组织名称"
              autofocus
            />
          </NFormItem>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
            <NButton @click="showCreateModal = false">
              取消
            </NButton>
            <NButton type="primary" :loading="creating" attr-type="submit">
              创建
            </NButton>
          </div>
        </NForm>
      </NModal>
    </template>
  </div>
</template>

<style scoped>
.org-card {
  cursor: pointer;
  height: 100%;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
}
.org-card:hover {
  border-color: var(--n-primary-color);
}
.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
