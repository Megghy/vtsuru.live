<script setup lang="ts">
import { LogOutOutline, Pencil, PeopleOutline, RefreshOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NForm, NFormItem, NIcon, NInput, NModal, NPageHeader, NPopconfirm, NTabPane, NTabs, NTag, NFlex, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isLoggedIn } from '@/api/account'
import { QueryPostAPI, unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/shared/config'
import '@/apps/org/styles/org-page.css'
import { provideOrgContext } from '../composables/useOrgContext'
import { provideOrgStreamers } from '../composables/useOrgStreamers'
import { provideOrgLives } from '../composables/useOrgLives'
import { roleLabel } from '../utils'
import OrgAnalyzeTab from '../components/tabs/OrgAnalyzeTab.vue'
import OrgLivesTab from '../components/tabs/OrgLivesTab.vue'
import OrgStreamersTab from '../components/tabs/OrgStreamersTab.vue'
import OrgMembersTab from '../components/tabs/OrgMembersTab.vue'
import OrgAdminGate from '../components/OrgAdminGate.vue'
import OrgPointManage from '../components/OrgPointManage.vue'
import OrgAuditTab from '../components/OrgAuditTab.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const orgId = computed(() => Number(route.params.orgId || 0))
const ctx = provideOrgContext(orgId)
const { orgInfo, orgName, myRole, isOrgAdmin, loadingOrgInfo, loadOrgInfo } = ctx
const streamersStore = provideOrgStreamers(ctx)
provideOrgLives(ctx)

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
    message.warning('请输入新名称')
    return
  }
  renaming.value = true
  try {
    unwrapOk(await QueryPostAPI(`${ORG_API_URL}${orgId.value}/rename`, { name }), '重命名失败')
    message.success('重命名成功')
    showRenameModal.value = false
    await loadOrgInfo()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '重命名失败')
  } finally {
    renaming.value = false
  }
}

async function leaveOrg() {
  if (!orgId.value) return
  try {
    unwrapOk(await QueryPostAPI(`${ORG_API_URL}${orgId.value}/leave`), '退出失败')
    message.success('已退出组织')
    router.push({ name: 'org-index' })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '退出失败')
  }
}

function openRename() {
  newOrgName.value = orgName.value
  showRenameModal.value = true
}
</script>

<template>
  <div class="org-page">
    <NCard v-if="!isLoggedIn">
      <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
        需要先登录才能查看组织数据。
      </NAlert>
      <RegisterAndLogin />
    </NCard>

    <template v-else>
      <NPageHeader @back="router.push({ name: 'org-index' })">
        <template #title>
          <NFlex align="center">
            <span>{{ orgName || `组织 ${orgId}` }}</span>
            <NButton v-if="isOrgAdmin" size="tiny" circle secondary @click="openRename">
              <template #icon>
                <NIcon :component="Pencil" />
              </template>
            </NButton>
          </NFlex>
        </template>
        <template #subtitle>
          ID: {{ orgId }}
        </template>
        <template #avatar>
          <NIcon :component="PeopleOutline" />
        </template>
        <template #extra>
          <NFlex>
            <NButton secondary @click="router.push({ name: 'manage-index' })">
              返回控制台
            </NButton>
            <NPopconfirm v-if="myRole !== 0" @positive-click="leaveOrg">
              <template #trigger>
                <NButton type="error" ghost>
                  <template #icon>
                    <NIcon :component="LogOutOutline" />
                  </template>
                  退出组织
                </NButton>
              </template>
              确定要退出该组织吗？
            </NPopconfirm>
            <NButton type="primary" :loading="loadingOrgInfo || streamersStore.loading.value" @click="reload">
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              刷新
            </NButton>
          </NFlex>
        </template>

        <NDescriptions :column="3" size="small" style="margin-top: 16px;">
          <NDescriptionsItem label="我的角色">
            <NTag :bordered="false" type="info" size="small">
              {{ orgInfo ? roleLabel(orgInfo.role) : '-' }}
            </NTag>
          </NDescriptionsItem>
          <NDescriptionsItem label="OwnerUserId">
            {{ orgInfo?.ownerUserId ?? '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="主播数">
            {{ streamersStore.streamers.value.length }}
          </NDescriptionsItem>
        </NDescriptions>
      </NPageHeader>

      <NTabs type="line" animated style="margin-top: 12px;">
        <NTabPane name="analyze" tab="数据分析" display-directive="show:lazy">
          <OrgAnalyzeTab />
        </NTabPane>
        <NTabPane name="lives" tab="直播记录" display-directive="show:lazy">
          <OrgLivesTab />
        </NTabPane>
        <NTabPane name="streamers" tab="主播管理" display-directive="show:lazy">
          <OrgStreamersTab />
        </NTabPane>
        <NTabPane name="members" tab="成员管理" display-directive="show:lazy">
          <OrgMembersTab />
        </NTabPane>
        <NTabPane name="points" tab="积分管理" display-directive="if">
          <OrgAdminGate message="需要组织管理员权限才能管理积分">
            <OrgPointManage />
          </OrgAdminGate>
        </NTabPane>
        <NTabPane name="shipping" tab="订单管理" display-directive="if">
          <OrgAdminGate message="需要组织管理员权限才能管理订单">
            <PointOrderManage :org-id="orgId" :streamer-options="streamersStore.options.value" />
          </OrgAdminGate>
        </NTabPane>
        <NTabPane name="audit" tab="操作审计" display-directive="if">
          <OrgAdminGate message="需要组织管理员权限才能查看审计">
            <OrgAuditTab />
          </OrgAdminGate>
        </NTabPane>
      </NTabs>

      <NModal v-model:show="showRenameModal" preset="card" title="重命名组织" style="width: 400px; max-width: 90vw;">
        <NForm @submit.prevent="renameOrg">
          <NFormItem label="新名称" :show-feedback="false">
            <NInput v-model:value="newOrgName" placeholder="请输入新名称" autofocus @keydown.enter.prevent="renameOrg" />
          </NFormItem>
          <NFlex justify="end" style="margin-top: 24px;">
            <NButton @click="showRenameModal = false">
              取消
            </NButton>
            <NButton type="primary" :loading="renaming" attr-type="submit">
              确定
            </NButton>
          </NFlex>
        </NForm>
      </NModal>
    </template>
  </div>
</template>

