<script setup lang="ts">
import { Copy20Regular } from '@vicons/fluent'
import { format } from 'date-fns'
import { ref } from 'vue'

import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'

import { useClipboard } from '../composables/useClipboard'
import type { OrgInviteMemberListItem, OrgInviteStreamerListItem } from '../types'
import { inviteStatusLabel, inviteStatusTagType, roleLabel } from '../utils'

type InviteItem = OrgInviteMemberListItem | OrgInviteStreamerListItem

const props = defineProps<{
  kind: 'member' | 'streamer'
  invites: InviteItem[]
  loading: boolean
  creating: boolean
  /** 是否展示角色选择（仅成员邀请） */
  withRole?: boolean
}>()

const emit = defineEmits<{
  (
    e: 'create',
    payload: {
      role?: number
      targetUserId?: number | null
      targetStreamerUserId?: number | null
      expireDays?: number | null
    },
  ): void
  (e: 'refresh'): void
  (e: 'revoke', token: string): void
}>()

const { copy } = useClipboard()

const role = ref(2)
const targetUserId = ref<number | null>(null)
const expireDays = ref<number | null>(7)

function targetName(inv: InviteItem): string {
  if ('targetUserName' in inv) return inv.targetUserName || (inv.targetUserId ? `ID: ${inv.targetUserId}` : '公开链接')
  return inv.targetStreamerUserName || (inv.targetStreamerUserId ? `ID: ${inv.targetStreamerUserId}` : '公开链接')
}

function submit() {
  emit('create', {
    role: props.withRole ? role.value : undefined,
    targetUserId: props.kind === 'member' ? targetUserId.value || undefined : undefined,
    targetStreamerUserId: props.kind === 'streamer' ? targetUserId.value || undefined : undefined,
    expireDays: expireDays.value || undefined,
  })
}
</script>

<template>
  <div class="space-y-3 mb-4">
    <Accordion
      type="single"
      collapsible
      class="border border-border/80 rounded-lg bg-card"
    >
      <AccordionItem
        value="create-invite"
        class="border-none"
      >
        <AccordionTrigger class="px-3.5 py-2.5 text-xs font-semibold hover:no-underline">
          {{ kind === 'member' ? '邀请成员' : '邀请主播' }}
        </AccordionTrigger>
        <AccordionContent class="px-3.5 pb-3 pt-1 space-y-3 text-xs">
          <div class="flex items-center gap-2 flex-wrap">
            <Select
              v-if="withRole"
              :model-value="String(role)"
              @update:model-value="role = Number($event)"
            >
              <SelectTrigger class="w-28">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="1"
                  class="text-xs"
                  >Admin</SelectItem
                >
                <SelectItem
                  value="2"
                  class="text-xs"
                  >Member</SelectItem
                >
              </SelectContent>
            </Select>

            <div class="min-w-[240px] flex-1">
              <UserAutocompleteSelect
                v-model:value="targetUserId"
                :placeholder="`输入B站UID/用户名搜索${kind === 'member' ? '成员' : '主播'}(可选)`"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="w-28">
              <NumberField
                v-model="expireDays"
                placeholder="有效期(天)"
                :min="1"
              />
            </div>

            <Popconfirm
              title="确定要发送邀请吗？"
              positive-text="确定"
              negative-text="取消"
              @positive-click="submit"
            >
              <template #trigger>
                <Button :disabled="creating"> 生成链接 </Button>
              </template>
              确定要发送邀请吗？
            </Popconfirm>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <Card class="border border-border/80">
      <CardHeader class="pb-2.5 border-b border-border/60 flex flex-row items-center justify-between">
        <CardTitle class="text-sm font-semibold">已发出邀请</CardTitle>
        <Button
          variant="outline"
          :disabled="loading"
          @click="emit('refresh')"
        >
          刷新邀请
        </Button>
      </CardHeader>

      <CardContent class="pt-3">
        <div
          v-if="loading"
          class="py-8 flex justify-center"
        >
          <Spin />
        </div>
        <div
          v-else-if="invites.length === 0"
          class="py-6"
        >
          <Empty description="暂无邀请" />
        </div>
        <div
          v-else
          class="divide-y divide-border/60"
        >
          <div
            v-for="inv in invites"
            :key="inv.token"
            class="py-3 first:pt-0 last:pb-0 space-y-2 text-xs"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="secondary"
                  class="text-[10px] h-4.5 px-1.5 font-normal"
                >
                  {{ inviteStatusLabel(inv.status) }}
                </Badge>
                <strong class="font-medium text-foreground text-xs">{{ targetName(inv) }}</strong>
                <Badge
                  v-if="withRole && 'role' in inv"
                  variant="outline"
                  class="text-[10px] h-4 px-1 text-primary border-primary/30"
                >
                  {{ roleLabel(inv.role) }}
                </Badge>
              </div>

              <span class="text-[11px] text-muted-foreground font-mono">
                过期时间: {{ format(inv.expiresAt, 'yyyy-MM-dd HH:mm') }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
              <span>
                使用次数: {{ inv.usedCount }}
                <template v-if="inv.lastUsedAt"> , 最近: {{ format(inv.lastUsedAt, 'MM-dd HH:mm') }} </template>
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Input
                size="xs"
                :value="inv.joinUrl"
                readonly
                class="font-mono flex-1 bg-muted/30"
              />
              <Button
                variant="outline"
                class="gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                @click="copy(inv.joinUrl)"
              >
                <component
                  :is="Copy20Regular"
                  class="size-3.5"
                />
                复制
              </Button>
              <Popconfirm
                v-if="!inv.isRevoked && inv.status !== 4"
                title="确定撤销该邀请吗？撤销后链接立即失效。"
                positive-text="确认撤销"
                negative-text="取消"
                @positive-click="emit('revoke', inv.token)"
              >
                <template #trigger>
                  <Button
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10"
                  >
                    撤销
                  </Button>
                </template>
                确定撤销该邀请吗？撤销后链接立即失效。
              </Popconfirm>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
