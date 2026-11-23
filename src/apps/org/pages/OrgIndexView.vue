<script setup lang="ts">
import {
  ArrowRight,
  Building2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  Video,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { getApiOrgMy } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { SettingRow } from '@/shared/ui/setting-row'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

import {
  getMyAuthorizedOrgs,
  postOrgCreate,
  postRevokeSelfStreamerAuth,
  postUpdateSelfStreamerPermission,
} from '../api'
import type { MyAuthorizedOrgItem, OrgInfoModel } from '../types'
import { formatDate, roleLabel } from '../utils'

const router = useRouter()

const isLoading = ref(false)
const loadError = ref<string | null>(null)
const orgs = ref<OrgInfoModel[]>([])

const search = ref('')
const roleFilter = ref<'all' | '0' | '1' | '2'>('all')

const authorizedLoading = ref(false)
const authorizedOrgs = ref<MyAuthorizedOrgItem[]>([])
const authorizedSupported = ref(true)
const revokingOrg = ref<MyAuthorizedOrgItem | null>(null)
const revokingBusy = ref(false)
const updatingPermOrgId = ref<number | null>(null)

const showCreateModal = ref(false)
const creating = ref(false)
const orgName = ref('')
const orgDescription = ref('')

const filteredOrgs = computed(() => {
  let list = orgs.value
  if (roleFilter.value !== 'all') {
    const r = Number(roleFilter.value)
    list = list.filter((o) => o.role === r)
  }
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(q)
        || String(o.id).includes(q)
        || (o.description ?? '').toLowerCase().includes(q),
    )
  }
  return list
})

async function loadMyOrgs() {
  if (!isLoggedIn.value) return
  isLoading.value = true
  loadError.value = null
  try {
    orgs.value = unwrapOk((await getApiOrgMy()) as any, '加载组织列表失败')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '加载组织列表失败'
    loadError.value = msg
    toast.error(msg)
  } finally {
    isLoading.value = false
  }
}

async function loadAuthorizedOrgs() {
  if (!isLoggedIn.value) return
  authorizedLoading.value = true
  try {
    const resp = await getMyAuthorizedOrgs()
    if (resp.code === 200) {
      authorizedOrgs.value = resp.data || []
      authorizedSupported.value = true
    } else {
      authorizedOrgs.value = []
    }
  } catch {
    // 后端尚未上线该接口时静默隐藏该分区，不影响组织列表页
    authorizedSupported.value = false
    authorizedOrgs.value = []
  } finally {
    authorizedLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadMyOrgs(), loadAuthorizedOrgs()])
}

async function createOrg() {
  if (creating.value) return
  const name = orgName.value.trim()
  if (!name) {
    toast.warning('请输入组织名称')
    return
  }
  creating.value = true
  try {
    unwrapOk(
      await postOrgCreate({
        name,
        description: orgDescription.value.trim() || undefined,
      }),
      '创建失败',
    )
    toast.success('组织创建成功')
    orgName.value = ''
    orgDescription.value = ''
    showCreateModal.value = false
    await loadMyOrgs()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '创建失败')
  } finally {
    creating.value = false
  }
}

async function togglePointManage(item: MyAuthorizedOrgItem, nextVal: boolean) {
  if (updatingPermOrgId.value === item.orgId) return
  updatingPermOrgId.value = item.orgId
  try {
    unwrapOk(await postUpdateSelfStreamerPermission(item.orgId, nextVal), '更新权限失败')
    item.allowPointManage = nextVal
    toast.success(nextVal ? '已允许该组织代管积分与订单' : '已关闭该组织的积分与订单代管权限')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '更新权限失败')
  } finally {
    updatingPermOrgId.value = null
  }
}

async function confirmRevokeAuth() {
  if (!revokingOrg.value || revokingBusy.value) return
  revokingBusy.value = true
  try {
    unwrapOk(await postRevokeSelfStreamerAuth(revokingOrg.value.orgId), '撤销授权失败')
    toast.success(`已撤销对「${revokingOrg.value.orgName}」的授权`)
    revokingOrg.value = null
    await loadAuthorizedOrgs()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '撤销授权失败')
  } finally {
    revokingBusy.value = false
  }
}

function openOrg(orgId: number) {
  router.push({ name: 'org-detail', params: { orgId } })
}

watch(
  () => isLoggedIn.value,
  async (loggedIn) => {
    if (!loggedIn) {
      orgs.value = []
      authorizedOrgs.value = []
      return
    }
    await refreshAll()
  },
  { immediate: true },
)
</script>

<template>
  <div class="org-page max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
    <template v-if="!isLoggedIn">
      <Card>
        <CardHeader class="p-4 border-b border-border/60">
          <CardTitle class="text-base">组织管理</CardTitle>
          <CardDescription class="text-xs">需要先登录才能查看或创建组织。</CardDescription>
        </CardHeader>
        <CardContent class="p-4">
          <RegisterAndLogin />
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <!-- 页头 -->
      <div class="flex-between gap-3 pb-4 border-b border-border/60 flex-wrap">
        <div>
          <h1 class="text-base font-semibold text-foreground m-0">组织管理</h1>
          <p class="text-xs text-muted-foreground mt-0.5 mb-0">管理你参与或创建的社团、公会及主播授权</p>
        </div>

        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="isLoading"
            @click="refreshAll"
          >
            <RefreshCw
              class="size-3.5"
              :class="{ 'animate-spin': isLoading }"
            />
            刷新
          </Button>
          <Button
            class="gap-1.5"
            @click="showCreateModal = true"
          >
            <Plus class="size-3.5" />
            创建组织
          </Button>
        </div>
      </div>

      <!-- 搜索与角色筛选 -->
      <div
        v-if="orgs.length > 0"
        class="flex-between gap-3 flex-wrap"
      >
        <div class="relative w-64 max-w-full">
          <Input
            v-model="search"
            placeholder="搜索组织名称、简介或 ID"
            class="pl-8"
          />
          <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <Tabs
          :model-value="roleFilter"
          class="w-auto"
          @update:model-value="roleFilter = $event as any"
        >
          <TabsList size="xs">
            <TabsTrigger value="all">全部 ({{ orgs.length }})</TabsTrigger>
            <TabsTrigger value="0">Owner</TabsTrigger>
            <TabsTrigger value="1">Admin</TabsTrigger>
            <TabsTrigger value="2">Member</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- 我的组织列表 -->
      <div v-if="loadError">
        <Alert variant="destructive">
          <AlertDescription class="flex-between gap-3 flex-wrap">
            <span>{{ loadError }}</span>
            <Button
              variant="outline"
              size="xs"
              @click="loadMyOrgs"
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>

      <div
        v-else-if="isLoading && orgs.length === 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
      >
        <Card
          v-for="i in 4"
          :key="i"
          class="p-4 space-y-3"
        >
          <div class="flex-between">
            <Skeleton class="size-9 rounded-lg" />
            <Skeleton class="w-14 h-5 rounded" />
          </div>
          <div class="space-y-1.5">
            <Skeleton class="w-3/5 h-4 rounded" />
            <Skeleton class="w-2/5 h-3 rounded" />
          </div>
          <Skeleton class="w-full h-8 rounded" />
        </Card>
      </div>

      <Empty
        v-else-if="orgs.length === 0"
        description="暂无参与或创建的组织"
        class="py-12"
      >
        <div class="mt-3">
          <Button
            class="gap-1.5"
            @click="showCreateModal = true"
          >
            <Plus class="size-3.5" />
            创建第一个组织
          </Button>
        </div>
      </Empty>

      <Empty
        v-else-if="filteredOrgs.length === 0"
        description="没有匹配的组织"
        class="py-10"
      />

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
      >
        <Card
          v-for="org in filteredOrgs"
          :key="org.id"
          class="p-4 card-interactive cursor-pointer flex flex-col justify-between gap-4 hover:border-primary/60"
          @click="openOrg(org.id)"
        >
          <div class="space-y-3">
            <div class="flex-between items-start gap-2">
              <div class="size-9 rounded-lg bg-primary/10 text-primary flex-center shrink-0">
                <Building2 class="size-4" />
              </div>
              <div class="flex items-center gap-1.5 flex-wrap justify-end">
                <Badge
                  v-if="(org.liveStreamerCount ?? 0) > 0"
                  variant="outline"
                  size="xs"
                  class="gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                >
                  <Radio class="size-3" />
                  {{ org.liveStreamerCount }} 在播
                </Badge>
                <Badge
                  variant="secondary"
                  size="xs"
                >
                  {{ roleLabel(org.role) }}
                </Badge>
              </div>
            </div>

            <div class="space-y-1 min-w-0">
              <div class="font-semibold text-sm text-foreground truncate">
                {{ org.name }}
              </div>
              <p
                v-if="org.description"
                class="text-xs text-muted-foreground line-clamp-2 m-0"
              >
                {{ org.description }}
              </p>
              <div class="flex items-center gap-3 text-[11px] text-muted-foreground font-mono tabular-nums pt-0.5">
                <span>ID: {{ org.id }}</span>
                <span
                  v-if="typeof org.memberCount === 'number'"
                  class="inline-flex items-center gap-1"
                >
                  <Users class="size-3" />
                  {{ org.memberCount }}
                </span>
                <span
                  v-if="typeof org.streamerCount === 'number'"
                  class="inline-flex items-center gap-1"
                >
                  <Video class="size-3" />
                  {{ org.streamerCount }}
                </span>
              </div>
            </div>
          </div>

          <div class="pt-2.5 border-t border-border/60">
            <Button
              variant="secondary"
              class="w-full gap-1.5"
            >
              进入管理
              <ArrowRight class="size-3.5" />
            </Button>
          </div>
        </Card>
      </div>

      <!-- 主播视角：我授权的组织 -->
      <Card v-if="authorizedSupported && (authorizedLoading || authorizedOrgs.length > 0)">
        <CardHeader class="p-4 border-b border-border/60 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck class="size-3.5 text-primary" />
              我已授权的组织（主播视角）
            </CardTitle>
            <CardDescription class="text-[11px] mt-0.5">
              可随时调整各组织的积分/订单代管权限，或主动撤销授权。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent class="p-4">
          <div
            v-if="authorizedLoading && authorizedOrgs.length === 0"
            class="space-y-2"
          >
            <Skeleton class="h-14 w-full rounded-lg" />
          </div>
          <div
            v-else
            class="divide-y divide-border/60"
          >
            <div
              v-for="item in authorizedOrgs"
              :key="item.orgId"
              class="py-3 first:pt-0 last:pb-0 flex-between gap-3 flex-wrap text-xs"
            >
              <div class="min-w-0 space-y-0.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <strong class="font-medium text-foreground text-sm">{{ item.orgName }}</strong>
                  <span class="text-[11px] text-muted-foreground font-mono">ID: {{ item.orgId }}</span>
                  <span
                    v-if="item.ownerName"
                    class="text-[11px] text-muted-foreground"
                  >
                    创建者: {{ item.ownerName }}
                  </span>
                </div>
                <p
                  v-if="item.orgDescription"
                  class="text-[11px] text-muted-foreground m-0 truncate max-w-md"
                >
                  {{ item.orgDescription }}
                </p>
                <div class="text-[11px] text-muted-foreground">
                  授权于 {{ formatDate(item.respondedAt || item.addedAt) }}
                </div>
              </div>

              <div class="flex items-center gap-3 flex-wrap">
                <SettingRow
                  title="积分与订单代管"
                  variant="none"
                  class="gap-2"
                >
                  <Switch
                    :checked="item.allowPointManage"
                    :disabled="updatingPermOrgId === item.orgId"
                    @update:checked="(val) => togglePointManage(item, val)"
                  />
                </SettingRow>

                <Button
                  variant="outline"
                  class="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                  @click="revokingOrg = item"
                >
                  <ShieldOff class="size-3.5" />
                  撤销授权
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 创建组织弹窗 -->
      <Dialog v-model:open="showCreateModal">
        <DialogContent class="sm:max-w-md p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm">创建新组织</DialogTitle>
          </DialogHeader>

          <form
            class="space-y-3"
            @submit.prevent="createOrg"
          >
            <FormField label="组织名称">
              <Input
                v-model="orgName"
                placeholder="请输入组织名称（最多 100 字）"
                :maxlength="100"
                autofocus
              />
            </FormField>

            <FormField
              label="组织简介"
              description="选填，将在组织主页与邀请预览页展示"
            >
              <Textarea
                v-model="orgDescription"
                rows="3"
                placeholder="简单介绍你的社团或团队..."
                :maxlength="500"
                class="resize-none"
              />
            </FormField>

            <DialogFooter class="pt-2 border-t border-border/60 gap-2">
              <Button
                type="button"
                variant="outline"
                @click="showCreateModal = false"
              >
                取消
              </Button>
              <Button
                type="submit"
                :disabled="creating"
              >
                {{ creating ? '创建中...' : '创建' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- 主播撤销授权确认 -->
      <AlertDialog
        :open="!!revokingOrg"
        @update:open="(v) => { if (!v) revokingOrg = null }"
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销组织授权？</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后，组织「{{ revokingOrg?.orgName }}」将立即无法读取你的实时直播数据、修改积分规则或管理你的积分订单。如需恢复，必须由组织重新发送授权邀请并经你同意。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="revokingBusy">取消</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              :disabled="revokingBusy"
              @click="confirmRevokeAuth"
            >
              {{ revokingBusy ? '处理中...' : '确认撤销' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>
