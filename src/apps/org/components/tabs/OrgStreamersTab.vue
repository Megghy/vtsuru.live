<script setup lang="ts">
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { format } from 'date-fns'
import { onMounted } from 'vue'

import { useFollowingStates } from '@/api/following'
import FollowButton from '@/components/common/FollowButton.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { injectOrgStreamers, useStreamerDetail } from '../../composables/useOrgStreamers'
import type { OrgInviteStreamerListItem } from '../../types'
import { streamerStatusLabel } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgStreamerDetailDrawer from '../OrgStreamerDetailDrawer.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin } = ctx
const { loading, includeAll, search, filtered, load, remove } = injectOrgStreamers()
const follows = useFollowingStates(() => filtered.value.map((s) => s.streamer.id))
const invites = useOrgInvites<OrgInviteStreamerListItem>(ctx, 'streamer')
const detail = useStreamerDetail(ctx)

onMounted(() => {
  if (isOrgAdmin.value) invites.load()
})

async function onSaved() {
  await load()
}
</script>

<template>
  <div
    v-if="loading"
    class="py-12 flex justify-center"
  >
    <Spin />
  </div>

  <div
    v-else
    class="space-y-3.5 text-xs"
  >
    <OrgInviteManager
      v-if="isOrgAdmin"
      kind="streamer"
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
        <Input
          v-model="search"
          placeholder="搜索主播名称或ID"
          class="pl-7"
        />
        <component
          :is="SearchOutline"
          class="size-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
        />
      </div>

      <div
        v-if="isOrgAdmin"
        class="flex items-center gap-2"
      >
        <span class="text-xs text-muted-foreground">包含非 Active 状态</span>
        <Switch v-model:checked="includeAll" />
      </div>
    </div>

    <div
      v-if="filtered.length === 0"
      class="py-10"
    >
      <Empty description="暂无主播" />
    </div>

    <!-- 主播列表 -->
    <Card
      v-else
      class="border border-border/80 overflow-hidden"
    >
      <CardContent class="p-0">
        <div class="divide-y divide-border/60">
          <div
            v-for="s in filtered"
            :key="s.streamer.id"
            class="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer select-none"
            @click="detail.open(s.streamer.id)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div @click.stop>
                <FollowButton
                  :user-id="s.streamer.id"
                  :following="follows.states.value[s.streamer.id]?.isFollowing"
                  @changed="follows.refresh"
                />
              </div>

              <OrgUserAvatar
                :face-url="s.streamer.faceUrl"
                :size="42"
              />

              <div class="min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-2">
                  <strong class="font-medium text-foreground text-sm truncate">{{ s.streamer.name }}</strong>
                  <Badge
                    variant="secondary"
                    class="text-[10px] h-4.5 px-1.5 font-normal"
                  >
                    {{ streamerStatusLabel(s.status) }}
                  </Badge>
                  <Badge
                    variant="outline"
                    class="text-[10px] h-4.5 px-1.5 font-normal"
                    :class="
                      s.streamer.isBiliAuthed
                        ? 'text-emerald-600 border-emerald-500/30'
                        : 'text-muted-foreground border-border/60'
                    "
                  >
                    {{ s.streamer.isBiliAuthed ? '已绑定B站' : '未绑定' }}
                  </Badge>
                </div>
                <span class="text-[11px] text-muted-foreground font-mono">ID: {{ s.streamer.id }}</span>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <div class="text-[11px] text-muted-foreground text-right space-y-0.5">
                <div>加入: {{ format(s.addedAt, 'yyyy-MM-dd') }}</div>
                <div v-if="s.respondedAt">响应: {{ format(s.respondedAt, 'yyyy-MM-dd') }}</div>
              </div>

              <div
                v-if="isOrgAdmin"
                @click.stop
              >
                <Popconfirm
                  title="确定要移除该主播吗？"
                  positive-text="确认移除"
                  negative-text="取消"
                  @positive-click="remove(s.streamer.id)"
                >
                  <template #trigger>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7 rounded-full text-destructive hover:bg-destructive/10"
                    >
                      <component
                        :is="TrashOutline"
                        class="size-3.5"
                      />
                    </Button>
                  </template>
                  确定要移除该主播吗？
                </Popconfirm>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>

  <OrgStreamerDetailDrawer
    :detail="detail"
    @saved="onSaved"
  />
</template>
