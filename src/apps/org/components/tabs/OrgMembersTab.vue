<script setup lang="ts">
import { ArrowRightLeft, Eye, Search, Trash2 } from 'lucide-vue-next'
import { format } from 'date-fns'
import { onMounted, ref, watch } from 'vue'

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
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { useOrgMembers } from '../../composables/useOrgMembers'
import type { OrgInviteMemberListItem, OrgMemberItem } from '../../types'
import { roleLabel } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin, myRole, orgInfo } = ctx
const { loading, error, search, filtered, load, remove, updateRole, updateRevenuePermission, transferOwner }
  = useOrgMembers(ctx)
const invites = useOrgInvites<OrgInviteMemberListItem>(ctx, 'member')

const transferTarget = ref<OrgMemberItem | null>(null)
const transferConfirmInput = ref('')
const transferring = ref(false)

function openTransferDialog(member: OrgMemberItem) {
  transferTarget.value = member
  transferConfirmInput.value = ''
}

async function confirmTransferOwner() {
  if (!transferTarget.value || transferConfirmInput.value.trim() !== transferTarget.value.user.name) return
  transferring.value = true
  try {
    const ok = await transferOwner(transferTarget.value.user.id)
    if (ok) transferTarget.value = null
  } finally {
    transferring.value = false
  }
}

watch(isOrgAdmin, (admin) => {
  if (admin && invites.invites.value.length === 0) void invites.load()
})

watch(
  () => ctx.refreshTick.value,
  () => {
    void load()
    if (isOrgAdmin.value) void invites.load()
  },
)

onMounted(async () => {
  await load()
  if (isOrgAdmin.value) await invites.load()
})
</script>

<template>
  <div class="space-y-4 text-xs">
    <OrgInviteManager
      v-if="isOrgAdmin"
      kind="member"
      with-role
      :can-invite-admin="myRole === 0"
      :invites="invites.invites.value"
      :loading="invites.loading.value"
      :creating="invites.creating.value"
      @create="invites.create"
      @refresh="invites.load"
      @revoke="invites.revoke"
    />

    <!-- 工具栏 -->
    <div class="flex-between gap-3 flex-wrap">
      <div class="relative w-60 max-w-full">
        <Input
          v-model="search"
          placeholder="搜索成员名称或 ID"
          class="pl-8"
        />
        <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <span class="text-[11px] text-muted-foreground font-mono tabular-nums">共 {{ filtered.length }} 位成员</span>
    </div>

    <Alert
      v-if="error"
      variant="destructive"
    >
      <AlertDescription class="flex-between gap-2">
        <span>{{ error }}</span>
        <Button
          variant="outline"
          size="xs"
          @click="load"
        >
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      v-else-if="loading && filtered.length === 0"
      class="py-12 flex-center"
    >
      <Spin />
    </div>

    <div
      v-else-if="filtered.length === 0"
      class="py-10"
    >
      <Empty description="暂无匹配成员" />
    </div>

    <!-- 成员列表 -->
    <Card
      v-else
      class="overflow-hidden"
    >
      <CardContent class="p-0">
        <div class="divide-y divide-border/60">
          <div
            v-for="m in filtered"
            :key="m.user.id"
            class="p-3.5 flex-between gap-3 flex-wrap hover:bg-muted/30 transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <OrgUserAvatar
                :face-url="m.user.faceUrl"
                :size="38"
              />

              <div class="min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="font-medium text-foreground text-sm truncate">{{ m.user.name }}</strong>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="
                      m.role === 0
                        ? 'text-primary border-primary/40 bg-primary/10'
                        : m.role === 1
                          ? 'text-sky-600 border-sky-500/30 bg-sky-500/10'
                          : 'text-muted-foreground border-border/60'
                    "
                  >
                    {{ roleLabel(m.role) }}
                  </Badge>
                  <Badge
                    v-if="m.role === 2 && m.canViewRevenue"
                    variant="secondary"
                    size="xs"
                    class="gap-1"
                  >
                    <Eye class="size-3" />
                    营收可见
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground font-mono tabular-nums">
                  ID: {{ m.user.id }} · 加入于 {{ format(m.joinedAt, 'yyyy-MM-dd') }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 flex-wrap">
              <!-- 普通 Member 营收权限开关 -->
              <Tooltip v-if="isOrgAdmin && m.role === 2">
                <TooltipTrigger as-child>
                  <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/20">
                    <span class="text-[11px] text-muted-foreground">营收可见</span>
                    <Switch
                      :checked="m.canViewRevenue === true"
                      @update:checked="(val) => updateRevenuePermission(m.user.id, val)"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>允许该普通成员查看组织内主播的收入与付费数据</TooltipContent>
              </Tooltip>

              <!-- Owner 调整角色（下拉切换，无冗余按钮） -->
              <template v-if="myRole === 0 && m.role !== 0 && m.user.id !== orgInfo?.ownerUserId">
                <Select
                  :model-value="String(m.role)"
                  @update:model-value="updateRole(m.user.id, Number($event))"
                >
                  <SelectTrigger class="w-26">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Admin</SelectItem>
                    <SelectItem value="2">Member</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="xs"
                  variant="outline"
                  class="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 gap-1"
                  @click="openTransferDialog(m)"
                >
                  <ArrowRightLeft class="size-3" />
                  移交所有权
                </Button>
              </template>

              <Popconfirm
                v-if="isOrgAdmin && myRole != null && m.role > myRole"
                :title="`确定要将「${m.user.name}」移出组织吗？若其为签约主播，授权也将同步解除。`"
                positive-text="确认移出"
                negative-text="取消"
                @positive-click="() => remove(m.user.id)"
              >
                <template #trigger>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    class="rounded-full text-destructive hover:bg-destructive/10"
                    aria-label="移出成员"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </template>
              </Popconfirm>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 移交所有权强确认弹窗 -->
    <AlertDialog
      :open="!!transferTarget"
      @update:open="(v) => { if (!v) transferTarget = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认移交组织所有权？</AlertDialogTitle>
          <AlertDialogDescription>
            你将把组织所有权移交给
            <strong class="text-foreground">{{ transferTarget?.user.name }}</strong>
            ，移交后你的角色将变更为 Admin。请输入对方用户名以确认。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <FormField label="输入目标成员用户名确认">
          <Input
            v-model="transferConfirmInput"
            :placeholder="transferTarget?.user.name || ''"
          />
        </FormField>

        <AlertDialogFooter>
          <AlertDialogCancel :disabled="transferring">取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-amber-600 text-white hover:bg-amber-700"
            :disabled="transferring || transferConfirmInput.trim() !== transferTarget?.user.name"
            @click="confirmTransferOwner"
          >
            {{ transferring ? '移交中...' : '确认移交' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
