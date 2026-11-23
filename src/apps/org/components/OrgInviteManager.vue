<script setup lang="ts">
import { Copy, Link2, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import { format } from 'date-fns'
import { computed, ref } from 'vue'

import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { copyToClipboard, toast } from '@/shared/utils'

import type { CreateInvitePayload } from '../composables/useOrgInvites'
import type { OrgInviteMemberListItem, OrgInviteStreamerListItem } from '../types'
import {
  OrgInviteStatuses,
  canRevokeInvite,
  inviteStatusBadgeClass,
  inviteStatusLabel,
  roleLabel,
} from '../utils'

type InviteItem = OrgInviteMemberListItem | OrgInviteStreamerListItem

const props = defineProps<{
  kind: 'member' | 'streamer'
  invites: InviteItem[]
  loading: boolean
  creating: boolean
  withRole?: boolean
  canInviteAdmin?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', payload: CreateInvitePayload): void
  (e: 'refresh'): void
  (e: 'revoke', token: string): void
}>()

const role = ref(2)
const targetUserId = ref<number | null>(null)
const expireDays = ref<number | null>(7)
const maxUses = ref<number | null>(null)
const allowPointManage = ref(true)
const statusFilter = ref<'all' | 'active' | 'accepted' | 'ended'>('all')

const filteredInvites = computed(() => {
  if (statusFilter.value === 'all') return props.invites
  if (statusFilter.value === 'active') {
    return props.invites.filter((i) => !i.isRevoked && (i.status === OrgInviteStatuses.Active || i.status === OrgInviteStatuses.Used))
  }
  if (statusFilter.value === 'accepted') {
    return props.invites.filter((i) => i.status === OrgInviteStatuses.Accepted)
  }
  return props.invites.filter(
    (i) =>
      i.isRevoked
      || i.status === OrgInviteStatuses.Expired
      || i.status === OrgInviteStatuses.Revoked
      || i.status === OrgInviteStatuses.Rejected,
  )
})

function targetName(inv: InviteItem): string {
  if ('targetUserName' in inv) return inv.targetUserName || (inv.targetUserId ? `ID: ${inv.targetUserId}` : '公开链接')
  return inv.targetStreamerUserName || (inv.targetStreamerUserId ? `ID: ${inv.targetStreamerUserId}` : '公开链接')
}

function creatorName(inv: InviteItem): string {
  return inv.createdByName || inv.createdByUserName || `UID ${inv.createdByUserId}`
}

async function copyUrl(url: string) {
  if (!url) return
  try {
    await copyToClipboard(url)
    toast.success('邀请链接已复制')
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

function submit() {
  emit('create', {
    role: props.withRole ? role.value : undefined,
    targetUserId: props.kind === 'member' ? targetUserId.value || undefined : undefined,
    targetStreamerUserId: props.kind === 'streamer' ? targetUserId.value || undefined : undefined,
    expireDays: expireDays.value || 7,
    maxUses: !targetUserId.value && maxUses.value && maxUses.value > 0 ? maxUses.value : undefined,
    allowPointManage: props.kind === 'streamer' ? allowPointManage.value : undefined,
  })
}
</script>

<template>
  <div class="space-y-3">
    <Accordion
      type="single"
      collapsible
      class="border border-border/80 rounded-lg bg-card"
    >
      <AccordionItem
        value="create-invite"
        class="border-none"
      >
        <AccordionTrigger class="px-4 py-3 text-xs font-semibold hover:no-underline">
          <span class="inline-flex items-center gap-1.5">
            <Link2 class="size-3.5 text-primary" />
            {{ kind === 'member' ? '创建成员邀请' : '创建主播授权邀请' }}
          </span>
        </AccordionTrigger>
        <AccordionContent class="px-4 pb-4 pt-1 space-y-3 text-xs">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FormField
              v-if="withRole"
              label="加入角色"
              class="min-w-0"
            >
              <Select
                :model-value="String(role)"
                @update:model-value="role = Number($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-if="canInviteAdmin !== false"
                    value="1"
                  >
                    Admin
                  </SelectItem>
                  <SelectItem value="2">Member</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              :label="`定向${kind === 'member' ? '成员' : '主播'}（选填）`"
              description="留空则生成公开邀请链接"
              class="min-w-0 sm:col-span-2"
            >
              <UserAutocompleteSelect
                v-model:value="targetUserId"
                :placeholder="`输入 B 站 UID / 用户名搜索${kind === 'member' ? '成员' : '主播'}`"
              />
            </FormField>

            <FormField
              label="有效期（天）"
              class="min-w-0"
            >
              <div class="space-y-1.5">
                <NumberField
                  v-model="expireDays"
                  :min="1"
                  :max="365"
                />
                <div class="flex items-center gap-1">
                  <Button
                    v-for="d in [1, 7, 30]"
                    :key="d"
                    type="button"
                    size="xs"
                    :variant="expireDays === d ? 'secondary' : 'ghost'"
                    @click="expireDays = d"
                  >
                    {{ d }}天
                  </Button>
                </div>
              </div>
            </FormField>

            <FormField
              v-if="!targetUserId"
              label="使用次数上限（选填）"
              description="留空不限制次数"
              class="min-w-0"
            >
              <NumberField
                v-model="maxUses"
                :min="1"
                :max="10000"
                placeholder="不限"
              />
            </FormField>
          </div>

          <SettingRow
            v-if="kind === 'streamer'"
            title="同时申请积分与订单代管权限"
            description="关闭后组织仅可查看该主播的直播与分析数据，不可修改其积分规则或处理订单"
            variant="compact"
          >
            <Switch v-model:checked="allowPointManage" />
          </SettingRow>

          <div class="flex items-center justify-end pt-1">
            <Button
              :disabled="creating"
              class="gap-1.5"
              @click="submit"
            >
              <Link2 class="size-3.5" />
              {{ creating ? '生成中...' : targetUserId ? '发送定向邀请并复制链接' : '生成并复制邀请链接' }}
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <Card>
      <CardHeader class="p-3.5 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle class="text-xs font-semibold">已发出邀请 ({{ invites.length }})</CardTitle>

        <div class="flex items-center gap-2 flex-wrap">
          <Tabs
            :model-value="statusFilter"
            class="w-auto"
            @update:model-value="statusFilter = $event as any"
          >
            <TabsList size="xs">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="active">有效</TabsTrigger>
              <TabsTrigger value="accepted">已接受</TabsTrigger>
              <TabsTrigger value="ended">已失效</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="xs"
            class="gap-1"
            :disabled="loading"
            @click="emit('refresh')"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': loading }"
            />
            刷新
          </Button>
        </div>
      </CardHeader>

      <CardContent class="p-3.5">
        <div
          v-if="loading && invites.length === 0"
          class="py-8 flex-center"
        >
          <Spin />
        </div>
        <div
          v-else-if="filteredInvites.length === 0"
          class="py-6"
        >
          <Empty :description="invites.length === 0 ? '暂无已发出的邀请' : '当前筛选下无邀请记录'" />
        </div>
        <div
          v-else
          class="divide-y divide-border/60"
        >
          <div
            v-for="inv in filteredInvites"
            :key="inv.token"
            class="py-3 first:pt-0 last:pb-0 space-y-2 text-xs"
          >
            <div class="flex-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  size="xs"
                  :class="inviteStatusBadgeClass(inv.status)"
                >
                  {{ inviteStatusLabel(inv.status) }}
                </Badge>
                <strong class="font-medium text-foreground text-xs">{{ targetName(inv) }}</strong>
                <Badge
                  v-if="withRole && 'role' in inv"
                  variant="outline"
                  size="xs"
                  class="text-primary border-primary/30"
                >
                  {{ roleLabel(inv.role) }}
                </Badge>
                <Badge
                  v-if="kind === 'streamer' && 'allowPointManage' in inv && inv.allowPointManage === false"
                  variant="outline"
                  size="xs"
                  class="text-muted-foreground"
                >
                  仅直播数据
                </Badge>
              </div>

              <span class="text-[11px] text-muted-foreground font-mono tabular-nums">
                过期时间: {{ format(inv.expiresAt, 'yyyy-MM-dd HH:mm') }}
              </span>
            </div>

            <div class="flex-between gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span>创建者: {{ creatorName(inv) }}</span>
              <span class="font-mono tabular-nums">
                使用次数: {{ inv.usedCount }}<template v-if="inv.maxUses">/{{ inv.maxUses }}</template
                ><template v-if="inv.lastUsedAt"> · 最近: {{ format(inv.lastUsedAt, 'MM-dd HH:mm') }}</template>
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Input
                size="xs"
                :model-value="inv.joinUrl"
                readonly
                class="font-mono flex-1 bg-muted/30"
              />
              <Button
                variant="outline"
                size="xs"
                class="gap-1 shrink-0"
                @click="copyUrl(inv.joinUrl)"
              >
                <Copy class="size-3" />
                复制
              </Button>
              <Popconfirm
                v-if="canRevokeInvite(inv.status, inv.isRevoked)"
                title="确定撤销该邀请吗？撤销后链接将立即失效。"
                positive-text="确认撤销"
                negative-text="取消"
                @positive-click="emit('revoke', inv.token)"
              >
                <template #trigger>
                  <Button
                    variant="ghost"
                    size="xs"
                    class="text-destructive hover:bg-destructive/10 shrink-0 gap-1"
                  >
                    <ShieldAlert class="size-3" />
                    撤销
                  </Button>
                </template>
              </Popconfirm>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
