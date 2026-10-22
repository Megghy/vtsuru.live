<script setup lang="ts">
import {
  ArrowLeft20Regular,
  ArrowSync20Regular,
  Edit20Regular,
  People24Regular,
  SignOut20Regular,
} from '@vicons/fluent'
import { TrashOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import {
  postApiOrgOrgIdDissolve,
  postApiOrgOrgIdLeave,
  postApiOrgOrgIdRename,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { toast } from '@/shared/utils'

import '@/apps/org/styles/org-page.css'

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

const orgId = computed(() => Number(route.params.orgId || 0))
const ctx = provideOrgContext(orgId)
const { orgInfo, orgName, myRole, isOrgAdmin, loadingOrgInfo, loadOrgInfo } = ctx
const streamersStore = provideOrgStreamers(ctx)
provideOrgLives(ctx)

const activeTab = ref('analyze')
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
    toast.warning('请输入新名称')
    return
  }
  renaming.value = true
  try {
    unwrapOk(await postApiOrgOrgIdRename(orgId.value, { name }), '重命名失败')
    toast.success('重命名成功')
    showRenameModal.value = false
    await loadOrgInfo()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '重命名失败')
  } finally {
    renaming.value = false
  }
}

async function leaveOrg() {
  if (!orgId.value) return
  try {
    unwrapOk(await postApiOrgOrgIdLeave(orgId.value), '退出失败')
    toast.success('已退出组织')
    router.push({ name: 'org-index' })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '退出失败')
  }
}

async function dissolveOrg() {
  if (!orgId.value) return
  try {
    unwrapOk(await postApiOrgOrgIdDissolve(orgId.value), '解散失败')
    toast.success('组织已解散')
    router.push({ name: 'org-index' })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '解散失败')
  }
}

function openRename() {
  newOrgName.value = orgName.value
  showRenameModal.value = true
}
</script>

<template>
  <div class="org-page p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
    <Card v-if="!isLoggedIn" class="border border-border/80">
      <CardContent class="p-4 space-y-3">
        <Alert class="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertDescription class="text-xs">需要先登录才能查看组织数据。</AlertDescription>
        </Alert>
        <RegisterAndLogin />
      </CardContent>
    </Card>

    <template v-else>
      <!-- 页头卡片 -->
      <Card class="border border-border/80">
        <CardContent class="p-4 space-y-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3">
              <Button variant="ghost" size="icon" class="size-8 rounded-full text-muted-foreground hover:text-foreground" aria-label="返回" @click="router.push({ name: 'org-index' })">
                <component :is="ArrowLeft20Regular" class="size-4" />
              </Button>

              <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <component :is="People24Regular" class="size-5" />
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h1 class="text-base font-semibold text-foreground truncate m-0">
                    {{ orgName || `组织 ${orgId}` }}
                  </h1>
                  <Button v-if="isOrgAdmin" variant="ghost" size="icon" class="size-6 rounded-full text-muted-foreground hover:text-foreground" title="重命名组织" @click="openRename">
                    <component :is="Edit20Regular" class="size-3.5" />
                  </Button>
                </div>
                <span class="text-xs text-muted-foreground font-mono">ID: {{ orgId }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <Button variant="outline" @click="router.push({ name: 'manage-index' })">
                返回控制台
              </Button>

              <Popconfirm
                v-if="myRole !== null && myRole !== 0"
                title="确定要退出该组织吗？"
                positive-text="确认退出"
                negative-text="取消"
                @positive-click="leaveOrg"
              >
                <template #trigger>
                  <Button variant="outline" class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                    <component :is="SignOut20Regular" class="size-3.5" />
                    退出组织
                  </Button>
                </template>
                确定要退出该组织吗？
              </Popconfirm>

              <Popconfirm
                v-else-if="myRole === 0"
                title="确定解散该组织吗？此操作不可恢复，将删除所有成员、主播、邀请与审计记录。"
                positive-text="确认解散"
                negative-text="取消"
                @positive-click="dissolveOrg"
              >
                <template #trigger>
                  <Button variant="outline" class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                    <component :is="TrashOutline" class="size-3.5" />
                    解散组织
                  </Button>
                </template>
                确定解散该组织吗？此操作不可恢复，将删除所有成员、主播、邀请与审计记录。
              </Popconfirm>

              <Button class="gap-1" :disabled="loadingOrgInfo || streamersStore.loading.value" @click="reload">
                <component :is="ArrowSync20Regular" class="size-3.5" />
                刷新
              </Button>
            </div>
          </div>

          <!-- 描述行 -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs">
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">我的角色</span>
              <Badge variant="outline" class="text-[10px] h-4.5 px-1.5 text-primary border-primary/30">
                {{ orgInfo ? roleLabel(orgInfo.role) : '-' }}
              </Badge>
            </div>
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">创建者 UID</span>
              <span class="font-mono text-foreground">{{ orgInfo?.ownerUserId ?? '-' }}</span>
            </div>
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">主播数</span>
              <span class="font-mono font-semibold text-foreground">{{ streamersStore.streamers.value.length }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 选项卡主内容区 -->
      <Tabs
        :model-value="activeTab"
        class="w-full space-y-3"
        @update:model-value="activeTab = $event as any"
      >
        <TabsList class="h-9 p-1 flex-wrap">
          <TabsTrigger value="analyze" class="text-xs">数据分析</TabsTrigger>
          <TabsTrigger value="lives" class="text-xs">直播记录</TabsTrigger>
          <TabsTrigger value="streamers" class="text-xs">主播管理</TabsTrigger>
          <TabsTrigger value="members" class="text-xs">成员管理</TabsTrigger>
          <TabsTrigger value="points" class="text-xs">积分管理</TabsTrigger>
          <TabsTrigger value="shipping" class="text-xs">订单管理</TabsTrigger>
          <TabsTrigger value="audit" class="text-xs">操作审计</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" class="mt-0">
          <OrgAnalyzeTab />
        </TabsContent>

        <TabsContent value="lives" class="mt-0">
          <OrgLivesTab />
        </TabsContent>

        <TabsContent value="streamers" class="mt-0">
          <OrgStreamersTab />
        </TabsContent>

        <TabsContent value="members" class="mt-0">
          <OrgMembersTab />
        </TabsContent>

        <TabsContent value="points" class="mt-0">
          <OrgAdminGate message="需要组织管理员权限才能管理积分">
            <OrgPointManage />
          </OrgAdminGate>
        </TabsContent>

        <TabsContent value="shipping" class="mt-0">
          <OrgAdminGate message="需要组织管理员权限才能管理订单">
            <PointOrderManage
              :org-id="orgId"
              :streamer-options="streamersStore.options.value"
            />
          </OrgAdminGate>
        </TabsContent>

        <TabsContent value="audit" class="mt-0">
          <OrgAdminGate message="需要组织管理员权限才能查看审计">
            <OrgAuditTab />
          </OrgAdminGate>
        </TabsContent>
      </Tabs>

      <!-- 重命名组织弹窗 -->
      <Dialog v-model:open="showRenameModal">
        <DialogContent class="sm:max-w-md p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm font-semibold">重命名组织</DialogTitle>
          </DialogHeader>

          <div class="space-y-1 text-xs">
            <label class="font-medium text-foreground text-xs">新名称</label>
            <Input v-model="newOrgName" placeholder="请输入新名称" @keydown.enter.prevent="renameOrg" />
          </div>

          <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
            <Button variant="outline" @click="showRenameModal = false">
              取消
            </Button>
            <Button :disabled="renaming" @click="renameOrg">
              {{ renaming ? '保存中...' : '确定' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
