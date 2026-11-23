<script setup lang="ts">
import {
  ArrowLeft,
  Building2,
  LogOut,
  Pencil,
  Radio,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { postApiOrgOrgIdDissolve, postApiOrgOrgIdLeave } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

import '@/apps/org/styles/org-page.css'

import { postOrgRenameLegacy, postOrgUpdate } from '../api'
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

const VALID_TABS = ['analyze', 'lives', 'streamers', 'members', 'points', 'shipping', 'audit'] as const
type OrgTab = (typeof VALID_TABS)[number]

const route = useRoute()
const router = useRouter()

const orgId = computed(() => {
  const n = Number(route.params.orgId)
  return Number.isInteger(n) && n > 0 ? n : 0
})

const ctx = provideOrgContext(orgId)
const { orgInfo, orgName, myRole, isOrgAdmin, loadingOrgInfo, orgError, loadOrgInfo, bumpRefresh } = ctx
const streamersStore = provideOrgStreamers(ctx)
const livesStore = provideOrgLives(ctx)

const activeTab = ref<OrgTab>(resolveInitialTab())
const showEditModal = ref(false)
const savingEdit = ref(false)
const editOrgName = ref('')
const editOrgDescription = ref('')

const showDissolveDialog = ref(false)
const dissolveConfirmInput = ref('')
const dissolving = ref(false)

function resolveInitialTab(): OrgTab {
  const raw = String(route.query.tab || '').trim()
  return (VALID_TABS as readonly string[]).includes(raw) ? (raw as OrgTab) : 'analyze'
}

const visibleTabs = computed(() => {
  const base: { value: OrgTab; label: string }[] = [
    { value: 'analyze', label: '数据分析' },
    { value: 'lives', label: '直播记录' },
    { value: 'streamers', label: '主播管理' },
    { value: 'members', label: '成员管理' },
  ]
  if (isOrgAdmin.value) {
    base.push(
      { value: 'points', label: '积分管理' },
      { value: 'shipping', label: '订单管理' },
      { value: 'audit', label: '操作审计' },
    )
  }
  return base
})

function onTabChange(val: string) {
  const next = (VALID_TABS as readonly string[]).includes(val) ? (val as OrgTab) : 'analyze'
  activeTab.value = next
  router.replace({ query: { ...route.query, tab: next } })
}

watch(
  () => route.query.tab,
  () => {
    const t = resolveInitialTab()
    if (t !== activeTab.value) activeTab.value = t
  },
)

async function reload(triggerChildren = false) {
  if (!isLoggedIn.value) return
  const ok = await loadOrgInfo()
  if (!ok) return
  await streamersStore.load()
  if (triggerChildren) bumpRefresh()
}

watch(
  [isLoggedIn, orgId],
  async ([loggedIn], [, prevOrgId]) => {
    if (prevOrgId && prevOrgId !== orgId.value) {
      livesStore.reset()
    }
    if (!loggedIn) return
    await reload(false)
  },
  { immediate: true },
)

watch(streamersStore.includeAll, () => {
  if (orgInfo.value) void streamersStore.load()
})

async function saveOrgInfo() {
  const name = editOrgName.value.trim()
  if (!name) {
    toast.warning('请输入组织名称')
    return
  }
  savingEdit.value = true
  try {
    try {
      unwrapOk(
        await postOrgUpdate(orgId.value, {
          name,
          description: editOrgDescription.value.trim() || undefined,
        }),
        '更新失败',
      )
    } catch {
      // 兼容线上旧后端未上线 /update 时回退 /rename
      unwrapOk(await postOrgRenameLegacy(orgId.value, { name }), '重命名失败')
    }
    toast.success('组织信息已更新')
    showEditModal.value = false
    await loadOrgInfo()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '更新失败')
  } finally {
    savingEdit.value = false
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
  if (!orgId.value || dissolveConfirmInput.value.trim() !== orgName.value) return
  dissolving.value = true
  try {
    unwrapOk(await postApiOrgOrgIdDissolve(orgId.value), '解散失败')
    toast.success('组织已解散')
    showDissolveDialog.value = false
    router.push({ name: 'org-index' })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '解散失败')
  } finally {
    dissolving.value = false
  }
}

function openEditModal() {
  editOrgName.value = orgName.value
  editOrgDescription.value = orgInfo.value?.description || ''
  showEditModal.value = true
}

function openDissolveDialog() {
  dissolveConfirmInput.value = ''
  showDissolveDialog.value = true
}
</script>

<template>
  <div class="org-page max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
    <Card v-if="!isLoggedIn">
      <CardContent class="p-4 space-y-3">
        <Alert
          size="sm"
          variant="warning"
        >
          <AlertDescription>需要先登录才能查看组织数据。</AlertDescription>
        </Alert>
        <RegisterAndLogin />
      </CardContent>
    </Card>

    <Card v-else-if="orgError">
      <CardContent class="p-4 space-y-3">
        <Alert variant="destructive">
          <AlertTitle>无法访问该组织</AlertTitle>
          <AlertDescription>{{ orgError }}</AlertDescription>
        </Alert>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-1.5"
            @click="router.push({ name: 'org-index' })"
          >
            <ArrowLeft class="size-3.5" />
            返回组织列表
          </Button>
          <Button
            v-if="orgId > 0"
            variant="outline"
            class="gap-1.5"
            @click="reload(false)"
          >
            <RefreshCw class="size-3.5" />
            重试
          </Button>
        </div>
      </CardContent>
    </Card>

    <div
      v-else-if="loadingOrgInfo && !orgInfo"
      class="py-16 flex-center"
    >
      <Spin />
    </div>

    <template v-else-if="orgInfo">
      <!-- 页头卡片 -->
      <Card>
        <CardContent class="p-4 space-y-3.5">
          <div class="flex-between gap-3 flex-wrap">
            <div class="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon-sm"
                class="rounded-full text-muted-foreground shrink-0"
                aria-label="返回组织列表"
                @click="router.push({ name: 'org-index' })"
              >
                <ArrowLeft class="size-4" />
              </Button>

              <div class="size-10 rounded-lg bg-primary/10 text-primary flex-center shrink-0">
                <Building2 class="size-5" />
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <h1 class="text-base font-semibold text-foreground truncate m-0">
                    {{ orgName }}
                  </h1>
                  <Button
                    v-if="isOrgAdmin"
                    variant="ghost"
                    size="icon-xs"
                    class="rounded-full text-muted-foreground"
                    aria-label="编辑组织信息"
                    @click="openEditModal"
                  >
                    <Pencil class="size-3.5" />
                  </Button>
                </div>
                <p
                  v-if="orgInfo.description"
                  class="text-xs text-muted-foreground truncate max-w-xl m-0 mt-0.5"
                >
                  {{ orgInfo.description }}
                </p>
                <span class="text-[11px] text-muted-foreground font-mono">ID: {{ orgId }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <Popconfirm
                v-if="myRole !== null && myRole !== 0"
                title="确定要退出该组织吗？退出后若你同时是签约主播，授权也将一并解除。"
                positive-text="确认退出"
                negative-text="取消"
                @positive-click="leaveOrg"
              >
                <template #trigger>
                  <Button
                    variant="outline"
                    class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  >
                    <LogOut class="size-3.5" />
                    退出组织
                  </Button>
                </template>
              </Popconfirm>

              <Button
                v-else-if="myRole === 0"
                variant="outline"
                class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                @click="openDissolveDialog"
              >
                <Trash2 class="size-3.5" />
                解散组织
              </Button>

              <Button
                variant="outline"
                class="gap-1.5"
                :disabled="loadingOrgInfo || streamersStore.loading.value"
                @click="reload(true)"
              >
                <RefreshCw
                  class="size-3.5"
                  :class="{ 'animate-spin': loadingOrgInfo || streamersStore.loading.value }"
                />
                刷新
              </Button>
            </div>
          </div>

          <!-- 组织摘要指标行 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60 text-xs">
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">我的角色</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  size="xs"
                  class="text-primary border-primary/30"
                >
                  {{ roleLabel(orgInfo.role) }}
                </Badge>
                <Badge
                  v-if="orgInfo.role === 2 && orgInfo.canViewRevenue"
                  variant="secondary"
                  size="xs"
                >
                  营收可见
                </Badge>
              </div>
            </div>

            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">创建者</span>
              <span class="font-medium text-foreground">
                {{ orgInfo.ownerName || `UID ${orgInfo.ownerUserId}` }}
              </span>
            </div>

            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">签约主播</span>
              <div class="flex items-center gap-2 font-mono tabular-nums">
                <span class="font-semibold text-foreground">
                  {{ orgInfo.streamerCount ?? streamersStore.activeCount.value }}
                </span>
                <Badge
                  v-if="(orgInfo.liveStreamerCount ?? 0) > 0"
                  variant="outline"
                  size="xs"
                  class="gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                >
                  <Radio class="size-3" />
                  {{ orgInfo.liveStreamerCount }} 在播
                </Badge>
              </div>
            </div>

            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">组织成员</span>
              <span class="font-mono font-semibold text-foreground tabular-nums">
                {{ orgInfo.memberCount ?? '-' }}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 主内容选项卡 -->
      <Tabs
        :model-value="activeTab"
        class="w-full space-y-3.5"
        @update:model-value="onTabChange(String($event))"
      >
        <div class="overflow-x-auto scrollbar-thin pb-0.5">
          <TabsList class="w-max">
            <TabsTrigger
              v-for="tab in visibleTabs"
              :key="tab.value"
              :value="tab.value"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="analyze"
          class="mt-0"
        >
          <OrgAnalyzeTab />
        </TabsContent>

        <TabsContent
          value="lives"
          class="mt-0"
        >
          <OrgLivesTab />
        </TabsContent>

        <TabsContent
          value="streamers"
          class="mt-0"
        >
          <OrgStreamersTab />
        </TabsContent>

        <TabsContent
          value="members"
          class="mt-0"
        >
          <OrgMembersTab />
        </TabsContent>

        <TabsContent
          value="points"
          class="mt-0"
        >
          <OrgAdminGate message="需要组织管理员权限才能管理积分">
            <OrgPointManage />
          </OrgAdminGate>
        </TabsContent>

        <TabsContent
          value="shipping"
          class="mt-0"
        >
          <OrgAdminGate message="需要组织管理员权限才能管理订单">
            <PointOrderManage
              :org-id="orgId"
              :streamer-options="streamersStore.pointManagedOptions.value"
            />
          </OrgAdminGate>
        </TabsContent>

        <TabsContent
          value="audit"
          class="mt-0"
        >
          <OrgAdminGate message="需要组织管理员权限才能查看审计">
            <OrgAuditTab />
          </OrgAdminGate>
        </TabsContent>
      </Tabs>

      <!-- 编辑组织弹窗 -->
      <Dialog v-model:open="showEditModal">
        <DialogContent class="sm:max-w-md p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm">编辑组织信息</DialogTitle>
          </DialogHeader>

          <form
            class="space-y-3"
            @submit.prevent="saveOrgInfo"
          >
            <FormField label="组织名称">
              <Input
                v-model="editOrgName"
                placeholder="请输入组织名称"
                :maxlength="100"
              />
            </FormField>

            <FormField
              label="组织简介"
              description="选填，最多 500 字"
            >
              <Textarea
                v-model="editOrgDescription"
                rows="3"
                placeholder="填写组织说明..."
                :maxlength="500"
                class="resize-none"
              />
            </FormField>

            <DialogFooter class="pt-2 border-t border-border/60 gap-2">
              <Button
                type="button"
                variant="outline"
                @click="showEditModal = false"
              >
                取消
              </Button>
              <Button
                type="submit"
                :disabled="savingEdit"
              >
                {{ savingEdit ? '保存中...' : '保存' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- 解散组织强确认弹窗 -->
      <AlertDialog v-model:open="showDissolveDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解散组织「{{ orgName }}」？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复，将移除所有成员与主播绑定、撤销全部邀请链接并清空组织记录。请输入组织名称
              <strong class="text-foreground">{{ orgName }}</strong>
              以确认解散。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FormField label="输入组织名称以确认">
            <Input
              v-model="dissolveConfirmInput"
              :placeholder="orgName"
            />
          </FormField>

          <AlertDialogFooter>
            <AlertDialogCancel :disabled="dissolving">取消</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              :disabled="dissolving || dissolveConfirmInput.trim() !== orgName"
              @click="dissolveOrg"
            >
              {{ dissolving ? '解散中...' : '确认解散' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>
