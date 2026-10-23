<script setup lang="ts">
import { format } from 'date-fns'
import { computed, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import {
  postApiForumCreate,
  postApiForumManageAddAdmin,
  postApiForumManageBan,
  postApiForumManageDeleteAdmin,
  postApiForumManageUnban,
  postApiForumManageUpdateSetting,
} from '@/api/generated/forum/forum'
import type { ForumUserInfo, ResponseForumModel, ResponseUserBasicInfo } from '@/api/generated/model'
import { ForumUserLevels } from '@/api/generated/model'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import UserBasicInfoCard from '@/apps/manage/components/UserBasicInfoCard.vue'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
// @ts-ignore
import Agreement from '@/content/agreements/EnableForumAgreement.md'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useMessage } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

const useForum = useForumStore()
const accountInfo = useAccount()
const message = useMessage()
const { run } = useApiAction()

const managedForums = ref<ResponseForumModel[]>([])

function forumByOwner(owner: number) {
  return managedForums.value.find((f) => f.owner.id === owner)
}

const currentForum = ref<ResponseForumModel>({} as ResponseForumModel)
const selectedForum = ref<string>('')

const readedAgreement = ref(false)
const showAgreement = ref(false)
const create_Name = ref('')
const create_Description = ref('')

const showAddAdminModal = ref(false)
const addAdminName = ref('')
const currentAdminInfo = ref<ResponseUserBasicInfo>()

const showBanModal = ref(false)
const addBanName = ref('')
const currentBanUserInfo = ref<ResponseUserBasicInfo>()

const levels = [
  {
    label: '1. 所有人',
    value: String(ForumUserLevels.Guest),
  },
  {
    label: '2. 已注册用户',
    value: String(ForumUserLevels.User),
  },
  {
    label: '3. 已加入的用户',
    value: String(ForumUserLevels.Member),
  },
  {
    label: '4. 加入并绑定B站的用户',
    value: String(ForumUserLevels.AuthedMember),
  },
  {
    label: '5. 仅管理员',
    value: String(ForumUserLevels.Admin),
  },
]

async function createForum() {
  if (!readedAgreement.value) {
    message.warning('请先阅读并同意服务协议')
    return
  }
  if (!create_Name.value) {
    message.warning('请输入名称')
    return
  }
  const data = await run<ResponseForumModel>(() => postApiForumCreate({ name: create_Name.value }), {
    success: '创建成功',
    fail: '创建失败',
  })
  if (data) {
    currentForum.value = data
    await refreshForumInfo()
  }
}

async function SwitchForum(owner: number | string) {
  const numOwner = Number(owner)
  selectedForum.value = String(numOwner)
  managedForums.value = (await useForum.GetManagedForums()) ?? []
  currentForum.value = forumByOwner(numOwner) ?? ({} as ResponseForumModel)
}

async function refreshForumInfo() {
  managedForums.value = (await useForum.GetManagedForums()) ?? []
  if (currentForum.value.owner?.id) {
    await SwitchForum(currentForum.value.owner.id)
  } else if (accountInfo.value.id) {
    await SwitchForum(accountInfo.value.id)
  }
}

async function addAdmin(id: number) {
  const ok = await run(() => postApiForumManageAddAdmin({ forum: currentForum.value.owner.id, id }), {
    success: '已设置为管理员',
  })
  if (ok) {
    await refreshForumInfo()
    addAdminName.value = ''
    showAddAdminModal.value = false
  }
}

async function removeAdmin(id: number) {
  if (
    await run(() => postApiForumManageDeleteAdmin({ forum: currentForum.value.owner.id, id }), {
      success: '已取消管理员权限',
    })
  ) {
    await refreshForumInfo()
  }
}

async function banUser(id: number) {
  if (
    await run(() => postApiForumManageBan({ forum: currentForum.value.owner.id, id }), {
      success: '已封禁用户',
    })
  ) {
    await refreshForumInfo()
    addBanName.value = ''
    showBanModal.value = false
  }
}

async function unbanUser(id: number) {
  if (await run(() => postApiForumManageUnban({ forum: currentForum.value.owner.id, id }), { success: '已解禁' })) {
    await refreshForumInfo()
  }
}

async function updateForumSettings() {
  if (
    await run(() => postApiForumManageUpdateSetting(currentForum.value.settings as any), {
      success: '修改成功',
      fail: '修改失败',
    })
  ) {
    await refreshForumInfo()
  }
}

async function confirmApplyUser(rowId: number) {
  const success = await useForum.ConfirmApply(currentForum.value.owner.id, rowId)
  if (success) {
    message.success('操作成功')
    currentForum.value.applying = currentForum.value.applying.filter((u) => u.id !== rowId)
  }
}

onMounted(async () => {
  managedForums.value = (await useForum.GetManagedForums()) ?? []
  const initial = forumByOwner(accountInfo.value.id)
  if (initial) {
    currentForum.value = initial
    selectedForum.value = String(initial.owner.id)
  }
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="粉丝讨论区"
      subtitle="创建与管理讨论区成员、权限与公告"
    >
      <template #action>
        <Button
          size="xs"
          variant="outline"
          :loading="useForum.isLoading"
          @click="refreshForumInfo"
        >
          刷新
        </Button>
      </template>
    </ManagePageHeader>

    <div class="flex items-center gap-2 flex-wrap">
      <div
        v-if="managedForums.length > 0"
        class="w-72"
      >
        <Select
          :model-value="selectedForum"
          @update:model-value="SwitchForum"
        >
          <SelectTrigger>
            <SelectValue placeholder="选择要管理的粉丝讨论区" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="f in managedForums"
              :key="f.owner.id"
              :value="String(f.owner.id)"
            >
              {{ (f.owner.id === accountInfo.id ? '[我的] ' : '') + f.name }} ({{ f.owner.name }})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        size="xs"
        variant="ghost"
        @click="SwitchForum(accountInfo.id)"
      >
        切换到我的讨论区
      </Button>
    </div>

    <!-- 未创建状态 -->
    <Card
      v-if="!currentForum.name"
      class="p-6 max-w-xl mx-auto space-y-4"
    >
      <Alert variant="destructive">
        <AlertTitle>尚未开通</AlertTitle>
        <AlertDescription class="text-xs">
          你尚未创建粉丝讨论区。开通后可以在此管理专属社区、设置入群门槛与指派房管。
        </AlertDescription>
      </Alert>

      <div class="space-y-3 pt-2">
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">讨论区名称</label>
          <Input
            v-model="create_Name"
            placeholder="例如：XX的粉丝根据地"
            maxlength="20"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">公告 / 描述 (可选)</label>
          <textarea
            v-model="create_Description"
            rows="3"
            placeholder="简要介绍讨论区的主题或入区规则"
            maxlength="200"
            class="w-full text-xs rounded-md border border-input bg-transparent px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div class="flex items-center gap-2 pt-1">
          <Checkbox
            :checked="readedAgreement"
            @update:checked="(val) => (readedAgreement = val)"
          />
          <span class="text-xs text-muted-foreground">
            已阅读并同意
            <button
              type="button"
              class="text-brand hover:underline font-medium"
              @click="showAgreement = true"
            >
              《开通粉丝讨论区服务协议》
            </button>
          </span>
        </div>

        <div class="pt-2">
          <Button
            variant="brand"
            class="w-full"
            @click="createForum"
          >
            立即创建粉丝讨论区
          </Button>
        </div>
      </div>
    </Card>

    <!-- 已开通工作台 -->
    <template v-else>
      <Tabs
        :key="selectedForum"
        default-value="info"
        class="w-full space-y-4"
      >
        <TabsList>
          <TabsTrigger value="info"> 基本信息与设置 </TabsTrigger>
          <TabsTrigger value="member"> 成员与权限 </TabsTrigger>
        </TabsList>

        <!-- Tab 1: 信息与设置 -->
        <TabsContent
          value="info"
          class="space-y-4"
        >
          <!-- 概览网格 -->
          <Card class="p-4">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">讨论区概览</h4>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-2.5 rounded-lg border border-border bg-muted/20">
                <div class="text-[11px] text-muted-foreground">名称</div>
                <div class="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {{ currentForum.name }}
                </div>
              </div>

              <div class="p-2.5 rounded-lg border border-border bg-muted/20">
                <div class="text-[11px] text-muted-foreground">创建者</div>
                <div class="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {{ currentForum.owner.name }}
                </div>
              </div>

              <div class="p-2.5 rounded-lg border border-border bg-muted/20">
                <div class="text-[11px] text-muted-foreground">帖子总数</div>
                <div class="text-sm font-bold font-mono text-foreground mt-0.5">
                  {{ currentForum.topicCount }}
                </div>
              </div>

              <div class="p-2.5 rounded-lg border border-border bg-muted/20">
                <div class="text-[11px] text-muted-foreground">创建时间</div>
                <div class="text-xs font-mono text-muted-foreground mt-1">
                  {{ format(currentForum.createAt, 'yyyy-MM-dd') }}
                </div>
              </div>
            </div>

            <div
              v-if="currentForum.description"
              class="mt-3 p-2.5 rounded-lg border border-border bg-muted/10 text-xs text-muted-foreground"
            >
              <span class="font-semibold text-foreground">公告：</span>{{ currentForum.description }}
            </div>
          </Card>

          <!-- 规则与权限开关 -->
          <Card class="p-4 space-y-4">
            <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">入区与发帖策略</h4>

            <div class="space-y-3">
              <div class="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                <div>
                  <div class="text-xs font-semibold text-foreground">加入需要管理员审批</div>
                  <div class="text-[11px] text-muted-foreground">
                    开启后，用户需申请并经由管理员在「成员与权限」面板同意后方可加入
                  </div>
                </div>
                <Checkbox
                  :checked="currentForum.settings.requireApply"
                  @update:checked="
                    (val) => {
                      currentForum.settings.requireApply = val
                      updateForumSettings()
                    }
                  "
                />
              </div>

              <div
                v-if="currentForum.settings.requireApply"
                class="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20"
              >
                <div>
                  <div class="text-xs font-semibold text-foreground">仅允许已绑定 Bilibili 的用户申请</div>
                  <div class="text-[11px] text-muted-foreground">过滤纯游客账号，提升粉丝群体真实度</div>
                </div>
                <Checkbox
                  :checked="currentForum.settings.requireAuthedToJoin"
                  @update:checked="
                    (val) => {
                      currentForum.settings.requireAuthedToJoin = val
                      updateForumSettings()
                    }
                  "
                />
              </div>

              <div class="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                <div>
                  <div class="text-xs font-semibold text-foreground">允许发布帖子</div>
                  <div class="text-[11px] text-muted-foreground">总开关，关闭后除管理员外全区禁止发表新帖</div>
                </div>
                <Checkbox
                  :checked="currentForum.settings.allowPost"
                  @update:checked="
                    (val) => {
                      currentForum.settings.allowPost = val
                      updateForumSettings()
                    }
                  "
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div class="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <div class="text-xs font-semibold text-foreground">允许谁查看讨论区</div>
                  <Select
                    :model-value="String(currentForum.settings.allowedViewerLevel)"
                    @update:model-value="
                      (val) => {
                        currentForum.settings.allowedViewerLevel = Number(val) as ForumUserLevels
                        updateForumSettings()
                      }
                    "
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="l in levels"
                        :key="l.value"
                        :value="l.value"
                      >
                        {{ l.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <div class="text-xs font-semibold text-foreground">允许谁发布帖子</div>
                  <Select
                    :model-value="String(currentForum.settings.allowedPostLevel)"
                    @update:model-value="
                      (val) => {
                        currentForum.settings.allowedPostLevel = Number(val) as ForumUserLevels
                        updateForumSettings()
                      }
                    "
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="l in levels"
                        :key="l.value"
                        :value="l.value"
                      >
                        {{ l.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <!-- Tab 2: 成员与权限 -->
        <TabsContent
          value="member"
          class="space-y-6"
        >
          <!-- 待审批申请 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold text-foreground">入区申请 ({{ currentForum.applying?.length || 0 }})</h4>
            </div>

            <div class="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>B站账号状态</TableHead>
                    <TableHead class="text-right"> 操作 </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-if="!currentForum.applying || currentForum.applying.length === 0"
                    class="text-center"
                  >
                    <TableCell
                      colspan="3"
                      class="py-6 text-xs text-muted-foreground"
                    >
                      暂无待审批的入区申请
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="user in currentForum.applying"
                    :key="user.id"
                  >
                    <TableCell class="text-xs font-semibold">
                      {{ user.name }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="user.isBiliAuthed ? 'secondary' : 'outline'"
                        class="text-[10px]"
                      >
                        {{ user.isBiliAuthed ? '已绑定' : '未绑定' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-right">
                      <Button
                        size="xs"
                        variant="brand"
                        @click="confirmApplyUser(user.id)"
                      >
                        通过申请
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- 讨论区成员 -->
          <div class="space-y-2">
            <h4 class="text-xs font-semibold text-foreground">成员列表 ({{ currentForum.members?.length || 0 }})</h4>

            <div class="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>B站账号</TableHead>
                    <TableHead class="text-right"> 操作 </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-if="!currentForum.members || currentForum.members.length === 0"
                    class="text-center"
                  >
                    <TableCell
                      colspan="3"
                      class="py-6 text-xs text-muted-foreground"
                    >
                      暂无成员
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="user in currentForum.members"
                    :key="user.id"
                  >
                    <TableCell class="text-xs font-semibold">
                      {{ user.name }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="user.isBiliAuthed ? 'secondary' : 'outline'"
                        class="text-[10px]"
                      >
                        {{ user.isBiliAuthed ? '已绑定' : '未绑定' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-right space-x-2">
                      <Button
                        size="xs"
                        variant="ghost"
                        class="text-destructive hover:bg-destructive/10"
                        @click="banUser(user.id)"
                      >
                        封禁
                      </Button>
                      <Button
                        v-if="currentForum.owner.id === accountInfo.id"
                        size="xs"
                        variant="ghost"
                        class="text-brand"
                        @click="addAdmin(user.id)"
                      >
                        设为管理员
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- 管理员 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold text-foreground">管理员 ({{ currentForum.admins?.length || 0 }})</h4>
              <Button
                size="xs"
                variant="brand"
                :disabled="currentForum.owner.id !== accountInfo.id"
                @click="showAddAdminModal = true"
              >
                添加管理员
              </Button>
            </div>

            <div class="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>B站账号</TableHead>
                    <TableHead class="text-right"> 操作 </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-if="!currentForum.admins || currentForum.admins.length === 0"
                    class="text-center"
                  >
                    <TableCell
                      colspan="3"
                      class="py-6 text-xs text-muted-foreground"
                    >
                      暂无管理员
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="user in currentForum.admins"
                    :key="user.id"
                  >
                    <TableCell class="text-xs font-semibold">
                      {{ user.name }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="user.isBiliAuthed ? 'secondary' : 'outline'"
                        class="text-[10px]"
                      >
                        {{ user.isBiliAuthed ? '已绑定' : '未绑定' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-right">
                      <Button
                        v-if="currentForum.owner.id === accountInfo.id"
                        size="xs"
                        variant="ghost"
                        class="text-destructive hover:bg-destructive/10"
                        @click="removeAdmin(user.id)"
                      >
                        取消管理员
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- 封禁黑名单 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold text-foreground">
                封禁用户 ({{ currentForum.blackList?.length || 0 }})
              </h4>
              <Button
                size="xs"
                variant="outline"
                @click="showBanModal = true"
              >
                封禁用户
              </Button>
            </div>

            <div class="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>B站账号</TableHead>
                    <TableHead class="text-right"> 操作 </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-if="!currentForum.blackList || currentForum.blackList.length === 0"
                    class="text-center"
                  >
                    <TableCell
                      colspan="3"
                      class="py-6 text-xs text-muted-foreground"
                    >
                      黑名单为空
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="user in currentForum.blackList"
                    :key="user.id"
                  >
                    <TableCell class="text-xs font-semibold">
                      {{ user.name }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="user.isBiliAuthed ? 'secondary' : 'outline'"
                        class="text-[10px]"
                      >
                        {{ user.isBiliAuthed ? '已绑定' : '未绑定' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        class="text-brand"
                        @click="unbanUser(user.id)"
                      >
                        解禁
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <!-- 协议弹窗 -->
    <Dialog
      :open="showAgreement"
      @update:open="(val) => (showAgreement = val)"
    >
      <DialogContent class="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>开通粉丝讨论区服务协议</DialogTitle>
          <DialogDescription class="text-xs"> 请详细阅读相关条款 </DialogDescription>
        </DialogHeader>
        <div class="prose prose-sm dark:prose-invert text-xs py-2">
          <Agreement />
        </div>
      </DialogContent>
    </Dialog>

    <!-- 添加管理员弹窗 -->
    <Dialog
      :open="showAddAdminModal"
      @update:open="(val) => (showAddAdminModal = val)"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加管理员</DialogTitle>
          <DialogDescription class="text-xs"> 输入用户名或 VTsuruId，查询并指派讨论区管理员 </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <UserBasicInfoCard
            :user="addAdminName"
            @update:user-info="(v) => (currentAdminInfo = v)"
          />

          <Input
            v-model="addAdminName"
            placeholder="请输入用户名或 VTsuruId"
          />
        </div>

        <DialogFooter>
          <Button
            size="xs"
            variant="ghost"
            @click="showAddAdminModal = false"
          >
            取消
          </Button>
          <Button
            size="xs"
            variant="brand"
            :disabled="!currentAdminInfo?.id"
            @click="addAdmin(currentAdminInfo!.id)"
          >
            确认添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 封禁用户弹窗 -->
    <Dialog
      :open="showBanModal"
      @update:open="(val) => (showBanModal = val)"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>封禁用户</DialogTitle>
          <DialogDescription class="text-xs"> 封禁后该用户将无法在讨论区查看或发言 </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <UserBasicInfoCard
            :user="addBanName"
            @update:user-info="(v) => (currentBanUserInfo = v)"
          />

          <Input
            v-model="addBanName"
            placeholder="请输入用户名或 VTsuruId"
          />
        </div>

        <DialogFooter>
          <Button
            size="xs"
            variant="ghost"
            @click="showBanModal = false"
          >
            取消
          </Button>
          <Button
            size="xs"
            variant="destructive"
            :disabled="!currentBanUserInfo?.id"
            @click="banUser(currentBanUserInfo!.id)"
          >
            确认封禁
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
