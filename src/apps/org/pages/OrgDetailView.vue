<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { QueryPostAPI, unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import { ORG_API_URL } from '@/shared/config'

import OrgAdminGate from '../components/OrgAdminGate.vue'
import OrgAuditTab from '../components/OrgAuditTab.vue'
import OrgPointManage from '../components/OrgPointManage.vue'
import OrgAnalyzeTab from '../components/tabs/OrgAnalyzeTab.vue'
import OrgLivesTab from '../components/tabs/OrgLivesTab.vue'
import OrgMembersTab from '../components/tabs/OrgMembersTab.vue'
import OrgStreamersTab from '../components/tabs/OrgStreamersTab.vue'
import { provideOrgContext } from '../composables/useOrgContext'
import { provideOrgLives } from '../composables/useOrgLives'
import { provideOrgStreamers } from '../composables/useOrgStreamers'
import { roleLabel } from '../utils'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const orgId = computed(() => Number(route.params.orgId || 0))
const ctx = provideOrgContext(orgId)
const { orgInfo, orgName, myRole, isOrgAdmin, loadingOrgInfo, loadOrgInfo } = ctx
const streamersStore = provideOrgStreamers(ctx)
provideOrgLives(ctx)

const activeTab = ref('analyze')
const tabItems = [
  { label: '数据分析', value: 'analyze', icon: 'i-lucide-chart-no-axes-combined' },
  { label: '直播记录', value: 'lives', icon: 'i-lucide-radio' },
  { label: '主播管理', value: 'streamers', icon: 'i-lucide-mic-vocal' },
  { label: '成员管理', value: 'members', icon: 'i-lucide-users' },
  { label: '积分管理', value: 'points', icon: 'i-lucide-circle-dollar-sign' },
  { label: '订单管理', value: 'shipping', icon: 'i-lucide-package-check' },
  { label: '操作审计', value: 'audit', icon: 'i-lucide-scroll-text' },
]
const showRenameModal = ref(false)
const renaming = ref(false)
const newOrgName = ref('')

async function reload() {
  if (!isLoggedIn.value || !orgId.value) return
  await loadOrgInfo()
  await streamersStore.load()
}

watch([isLoggedIn, orgId], reload, { immediate: true })
watch(streamersStore.includeAll, () => streamersStore.load())

async function renameOrg() {
  const name = newOrgName.value.trim()
  if (!name) {
    toast.add({ title: '请输入新名称', color: 'warning' })
    return
  }
  renaming.value = true
  try {
    unwrapOk(await QueryPostAPI(`${ORG_API_URL}${orgId.value}/rename`, { name }), '重命名失败')
    toast.add({ title: '重命名成功', color: 'success' })
    showRenameModal.value = false
    await loadOrgInfo()
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '重命名失败', color: 'error' })
  } finally {
    renaming.value = false
  }
}

async function leaveOrg() {
  if (!orgId.value) return
  try {
    unwrapOk(await QueryPostAPI(`${ORG_API_URL}${orgId.value}/leave`), '退出失败')
    toast.add({ title: '已退出组织', color: 'success' })
    router.push({ name: 'org-index' })
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '退出失败', color: 'error' })
  }
}

function openRename() {
  newOrgName.value = orgName.value
  showRenameModal.value = true
}
</script>

<template>
  <div class="org-page">
    <UCard v-if="!isLoggedIn">
      <UAlert
        color="warning"
        icon="i-lucide-triangle-alert"
        title="需要先登录才能查看组织数据"
      />
      <RegisterAndLogin class="mt-3" />
    </UCard>

    <template v-else>
      <section class="org-detail-header">
        <div class="org-detail-header__identity">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            aria-label="返回组织列表"
            @click="router.push({ name: 'org-index' })"
          />
          <UIcon
            name="i-lucide-building-2"
            class="org-detail-header__icon"
          />
          <div>
            <div class="org-detail-header__title-row">
              <h1>{{ orgName || `组织 ${orgId}` }}</h1>
              <UButton
                v-if="isOrgAdmin"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-pencil"
                aria-label="重命名组织"
                @click="openRename"
              />
            </div>
            <p>ID: {{ orgId }}</p>
          </div>
        </div>

        <div class="org-detail-header__actions">
          <UButton
            color="neutral"
            variant="soft"
            @click="router.push({ name: 'manage-index' })"
          >
            返回控制台
          </UButton>
          <UPopover v-if="myRole !== 0">
            <UButton
              color="error"
              variant="soft"
              icon="i-lucide-log-out"
            >
              退出组织
            </UButton>
            <template #content="{ close }">
              <div class="org-confirm">
                <p>确定要退出该组织吗？</p>
                <div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="close"
                  >
                    取消
                  </UButton>
                  <UButton
                    color="error"
                    size="xs"
                    @click="(close(), leaveOrg())"
                  >
                    退出组织
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
          <UButton
            icon="i-lucide-refresh-cw"
            :loading="loadingOrgInfo || streamersStore.loading.value"
            @click="reload"
          >
            刷新
          </UButton>
        </div>
      </section>

      <dl class="org-detail-meta">
        <div>
          <dt>我的角色</dt>
          <dd>
            <UBadge
              color="info"
              variant="soft"
              size="sm"
            >
              {{ orgInfo ? roleLabel(orgInfo.role) : '-' }}
            </UBadge>
          </dd>
        </div>
        <div>
          <dt>OwnerUserId</dt>
          <dd>{{ orgInfo?.ownerUserId ?? '-' }}</dd>
        </div>
        <div>
          <dt>主播数</dt>
          <dd>{{ streamersStore.streamers.value.length }}</dd>
        </div>
      </dl>

      <UTabs
        v-model="activeTab"
        :items="tabItems"
        :content="false"
      />

      <section v-show="activeTab === 'analyze'">
        <OrgAnalyzeTab />
      </section>
      <section v-show="activeTab === 'lives'">
        <OrgLivesTab />
      </section>
      <section v-show="activeTab === 'streamers'">
        <OrgStreamersTab />
      </section>
      <section v-show="activeTab === 'members'">
        <OrgMembersTab />
      </section>
      <section v-show="activeTab === 'points'">
        <OrgAdminGate message="需要组织管理员权限才能管理积分">
          <OrgPointManage />
        </OrgAdminGate>
      </section>
      <section v-show="activeTab === 'shipping'">
        <OrgAdminGate message="需要组织管理员权限才能管理订单">
          <PointOrderManage
            :org-id="orgId"
            :streamer-options="streamersStore.options.value"
          />
        </OrgAdminGate>
      </section>
      <section v-show="activeTab === 'audit'">
        <OrgAdminGate message="需要组织管理员权限才能查看审计">
          <OrgAuditTab />
        </OrgAdminGate>
      </section>

      <UModal
        v-model:open="showRenameModal"
        title="重命名组织"
        :ui="{ content: 'sm:max-w-md' }"
      >
        <template #body>
          <form
            id="rename-org-form"
            @submit.prevent="renameOrg"
          >
            <UFormField label="新名称">
              <UInput
                v-model="newOrgName"
                placeholder="请输入新名称"
                autofocus
              />
            </UFormField>
          </form>
        </template>
        <template #footer>
          <div class="org-modal-actions">
            <UButton
              color="neutral"
              variant="ghost"
              @click="showRenameModal = false"
            >
              取消
            </UButton>
            <UButton
              type="submit"
              form="rename-org-form"
              :loading="renaming"
            >
              确定
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>

<style scoped>
.org-detail-header,
.org-detail-header__identity,
.org-detail-header__title-row,
.org-detail-header__actions,
.org-modal-actions,
.org-confirm > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.org-page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.org-detail-header {
  justify-content: space-between;
  padding: 4px 0;
}

.org-detail-header__identity {
  min-width: 0;
}

.org-detail-header__icon {
  flex: none;
  color: var(--vtsuru-brand);
  font-size: 28px;
}

.org-detail-header h1,
.org-detail-header p {
  margin: 0;
}

.org-detail-header h1 {
  font-size: 20px;
}

.org-detail-header p {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.org-detail-header__actions,
.org-modal-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.org-detail-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 4px 0 8px;
}

.org-detail-meta > div {
  padding: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

.org-detail-meta dt {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.org-detail-meta dd {
  margin: 5px 0 0;
  font-weight: 600;
}

.org-confirm {
  display: grid;
  gap: 12px;
  min-width: 230px;
  padding: 12px;
}

.org-confirm p {
  margin: 0;
}

.org-confirm > div {
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .org-page {
    padding: 8px;
  }

  .org-detail-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .org-detail-header__actions {
    justify-content: flex-start;
  }

  .org-detail-meta {
    grid-template-columns: 1fr;
  }
}
</style>
