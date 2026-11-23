<script setup lang="ts">
import { Search, Trash2 } from 'lucide-vue-next'
import { format } from 'date-fns'
import { onMounted, watch } from 'vue'

import { useFollowingStates } from '@/api/following'
import FollowButton from '@/components/common/FollowButton.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { injectOrgStreamers, useStreamerDetail } from '../../composables/useOrgStreamers'
import type { OrgInviteStreamerListItem } from '../../types'
import { streamerStatusBadgeClass, streamerStatusLabel } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgStreamerDetailDrawer from '../OrgStreamerDetailDrawer.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin } = ctx
const { loading, error, includeAll, search, filtered, load, remove } = injectOrgStreamers()
const follows = useFollowingStates(() => filtered.value.map((s) => s.streamer.id))
const invites = useOrgInvites<OrgInviteStreamerListItem>(ctx, 'streamer')
const detail = useStreamerDetail(ctx)

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

onMounted(() => {
  if (isOrgAdmin.value) void invites.load()
})

async function onSaved() {
  await load()
}
</script>

<template>
  <div class="space-y-4 text-xs">
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
    <div class="flex-between gap-3 flex-wrap">
      <div class="relative w-60 max-w-full">
        <Input
          v-model="search"
          placeholder="搜索主播名称或 ID"
          class="pl-8"
        />
        <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <SettingRow
        v-if="isOrgAdmin"
        title="包含非授权状态"
        variant="none"
        class="gap-2"
      >
        <Switch v-model:checked="includeAll" />
      </SettingRow>
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
      <Empty description="暂无匹配主播" />
    </div>

    <!-- 主播列表 -->
    <Card
      v-else
      class="overflow-hidden"
    >
      <CardContent class="p-0">
        <div class="divide-y divide-border/60">
          <div
            v-for="s in filtered"
            :key="s.streamer.id"
            class="p-3.5 flex-between gap-3 flex-wrap hover:bg-muted/30 transition-colors cursor-pointer select-none"
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
                :size="40"
              />

              <div class="min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="font-medium text-foreground text-sm truncate">{{ s.streamer.name }}</strong>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="streamerStatusBadgeClass(s.status)"
                  >
                    {{ streamerStatusLabel(s.status) }}
                  </Badge>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="
                      s.streamer.isBiliAuthed
                        ? 'text-emerald-600 border-emerald-500/30'
                        : 'text-muted-foreground border-border/60'
                    "
                  >
                    {{ s.streamer.isBiliAuthed ? '已绑定 B 站' : '未绑定' }}
                  </Badge>
                  <Badge
                    v-if="s.status === 1 && s.allowPointManage === false"
                    variant="outline"
                    size="xs"
                    class="text-muted-foreground"
                  >
                    仅直播数据
                  </Badge>
                </div>
                <div class="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span class="font-mono tabular-nums">ID: {{ s.streamer.id }}</span>
                  <span
                    v-if="s.note"
                    class="truncate max-w-xs"
                  >
                    · {{ s.note }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <div class="text-[11px] text-muted-foreground font-mono tabular-nums text-right space-y-0.5">
                <div>加入: {{ format(s.addedAt, 'yyyy-MM-dd') }}</div>
                <div v-if="s.respondedAt">响应: {{ format(s.respondedAt, 'yyyy-MM-dd') }}</div>
              </div>

              <div
                v-if="isOrgAdmin && s.status === 1"
                @click.stop
              >
                <Popconfirm
                  :title="`确定解除主播「${s.streamer.name}」的绑定吗？解除后如需恢复须重新发起邀请。`"
                  positive-text="确认移除"
                  negative-text="取消"
                  @positive-click="remove(s.streamer.id)"
                >
                  <template #trigger>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="rounded-full text-destructive hover:bg-destructive/10"
                      aria-label="移除主播"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </template>
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
