<script setup lang="ts">
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { format } from 'date-fns'
import { onMounted } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { useOrgMembers } from '../../composables/useOrgMembers'
import type { OrgInviteMemberListItem } from '../../types'
import { roleLabel } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin, myRole, orgInfo } = ctx
const { loading, search, filtered, load, remove, updateRole, transferOwner } = useOrgMembers(ctx)
const invites = useOrgInvites<OrgInviteMemberListItem>(ctx, 'member')

onMounted(async () => {
  await load()
  if (isOrgAdmin.value) await invites.load()
})
</script>

<template>
  <div v-if="loading" class="py-12 flex justify-center">
    <Spin />
  </div>

  <div v-else class="space-y-3.5 text-xs">
    <OrgInviteManager
      v-if="isOrgAdmin"
      kind="member"
      with-role
      :invites="invites.invites.value"
      :loading="invites.loading.value"
      :creating="invites.creating.value"
      @create="invites.create"
      @refresh="invites.load"
      @revoke="invites.revoke"
    />

    <!-- 工具栏 -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="relative w-56">
        <Input v-model="search" placeholder="搜索成员名称或ID" class="pl-7" />
        <component :is="SearchOutline" class="size-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>

    <div v-if="filtered.length === 0" class="py-10">
      <Empty description="暂无成员" />
    </div>

    <!-- 成员列表 -->
    <Card v-else class="border border-border/80 overflow-hidden">
      <CardContent class="p-0">
        <div class="divide-y divide-border/60">
          <div
            v-for="m in filtered"
            :key="m.user.id"
            class="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <OrgUserAvatar
                :face-url="m.user.faceUrl"
                :size="40"
              />

              <div class="min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <strong class="font-medium text-foreground text-sm truncate">{{ m.user.name }}</strong>
                  <Badge variant="outline" class="text-[10px] h-4 px-1 text-primary border-primary/30">
                    {{ roleLabel(m.role) }}
                  </Badge>
                </div>
                <span class="text-[11px] text-muted-foreground font-mono">ID: {{ m.user.id }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
              <span class="text-[11px] text-muted-foreground">
                加入于 {{ format(m.joinedAt, 'yyyy-MM-dd') }}
              </span>

              <template v-if="myRole === 0 && m.role !== 0 && m.user.id !== orgInfo?.ownerUserId">
                <Popconfirm
                  title="确定要将该成员设为 Admin 吗？"
                  positive-text="确定"
                  negative-text="取消"
                  @positive-click="() => updateRole(m.user.id, 1)"
                >
                  <template #trigger>
                    <Button variant="outline" class="h-6 text-[11px] px-2 text-primary">
                      设为 Admin
                    </Button>
                  </template>
                  确定要将该成员设为 Admin 吗？
                </Popconfirm>

                <Popconfirm
                  title="确定要将该成员设为 Member 吗？"
                  positive-text="确定"
                  negative-text="取消"
                  @positive-click="() => updateRole(m.user.id, 2)"
                >
                  <template #trigger>
                    <Button variant="outline" class="h-6 text-[11px] px-2">
                      设为 Member
                    </Button>
                  </template>
                  确定要将该成员设为 Member 吗？
                </Popconfirm>

                <Popconfirm
                  title="确定将该成员设为新的 Owner 吗？你将降级为 Member。"
                  positive-text="确认移交"
                  negative-text="取消"
                  @positive-click="() => transferOwner(m.user.id)"
                >
                  <template #trigger>
                    <Button variant="outline" class="h-6 text-[11px] px-2 text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                      移交所有权
                    </Button>
                  </template>
                  确定将该成员设为新的 Owner 吗？你将降级为 Member。
                </Popconfirm>
              </template>

              <Popconfirm
                v-if="isOrgAdmin && myRole != null && m.role > myRole"
                title="确定要移除该成员吗？"
                positive-text="确认移除"
                negative-text="取消"
                @positive-click="() => remove(m.user.id)"
              >
                <template #trigger>
                  <Button size="icon" variant="ghost" class="size-7 rounded-full text-destructive hover:bg-destructive/10">
                    <component :is="TrashOutline" class="size-3.5" />
                  </Button>
                </template>
                确定要移除该成员吗？
              </Popconfirm>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
