<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Clock,
  Lock,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-vue-next'
import { computed, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseAccountInfo } from '@/api/generated/model'
import {
  type ManageNavItem,
  useManageNavigation,
} from '@/apps/manage/composables/useManageNavigation'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  accountInfo: ResponseAccountInfo
}>()

const emit = defineEmits<{
  requireBiliAuth: []
}>()

const router = useRouter()
const message = useMessage()

const {
  isBiliVerified,
  favoriteItems,
  quickAccessEntries,
  groupedStreamerItems,
  isFavorite,
  toggleFavorite,
  moveFavorite,
  clearFavorites,
  recordRecent,
} = useManageNavigation(toRef(props, 'accountInfo'))

const customizeOpen = ref(false)
const searchKeyword = ref('')

const subtitleText = computed(() => {
  const favCount = favoriteItems.value.length
  const hasRecent = quickAccessEntries.value.some((entry) => entry.source === 'recent')
  if (favCount === 0) {
    return hasRecent ? '按最近访问与常用推荐展示，点击书签可固定常用功能' : '点击卡片右上角书签或「自定义」固定常用功能'
  }
  if (quickAccessEntries.value.length > favCount) {
    return `已固定 ${favCount} 项，其余按最近访问与常用推荐补齐`
  }
  return `已固定 ${favCount} 项收藏功能（与侧边栏同步）`
})

const filteredGroups = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return groupedStreamerItems.value
  return groupedStreamerItems.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          (item.description?.toLowerCase().includes(keyword) ?? false),
      ),
    }))
    .filter((group) => group.items.length > 0)
})

function openEntry(item: ManageNavItem) {
  if (item.disabled) {
    message.warning(item.disabledReason || '当前无法使用此功能')
    if (!isBiliVerified.value && item.group === 'danmaku') {
      emit('requireBiliAuth')
    }
    return
  }
  if (!item.to) return
  recordRecent(item.key)
  void router.push(item.to)
}
</script>

<template>
  <Card>
    <CardContent class="p-4 space-y-3">
      <div class="flex-between gap-2 flex-wrap">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-foreground">快捷入口</div>
          <div class="text-[11px] text-muted-foreground mt-0.5">
            {{ subtitleText }}
          </div>
        </div>

        <Button
          size="xs"
          variant="outline"
          @click="customizeOpen = true"
        >
          <SlidersHorizontal class="size-3.5" />
          自定义
        </Button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div
          v-for="entry in quickAccessEntries"
          :key="entry.item.key"
          role="button"
          tabindex="0"
          class="group relative flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :class="
            entry.item.disabled
              ? 'opacity-60 hover:bg-muted/40'
              : 'hover:border-brand/40 hover:bg-muted/35'
          "
          @click="openEntry(entry.item)"
          @keydown.enter.prevent="openEntry(entry.item)"
          @keydown.space.prevent="openEntry(entry.item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div
              class="size-8 rounded-md flex-center shrink-0"
              :class="
                entry.item.accent === 'brand'
                  ? 'bg-brand/10 text-brand'
                  : 'bg-muted text-foreground'
              "
            >
              <component
                :is="entry.item.icon"
                class="size-4"
              />
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <span
                v-if="entry.source === 'recent'"
                class="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground leading-none"
                title="最近访问"
              >
                <Clock class="size-2.5" />
                最近
              </span>

              <Button
                variant="ghost"
                size="none"
                class="size-6 rounded-md flex-center transition-opacity duration-150"
                :class="
                  entry.source === 'favorite'
                    ? 'opacity-100 text-amber-500 hover:bg-amber-500/15'
                    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-foreground'
                "
                :aria-label="isFavorite(entry.item.key) ? '取消固定' : '固定到快捷入口'"
                :title="isFavorite(entry.item.key) ? '取消固定' : '固定到快捷入口'"
                @click.stop="toggleFavorite(entry.item.key)"
              >
                <Bookmark
                  class="size-3.5"
                  :class="entry.source === 'favorite' ? 'fill-current' : ''"
                />
              </Button>
            </div>
          </div>

          <div class="min-w-0 space-y-0.5">
            <div class="flex items-center gap-1 min-w-0">
              <span class="text-xs font-medium text-foreground truncate">
                {{ entry.item.label }}
              </span>
              <Lock
                v-if="entry.item.disabled"
                class="size-3 text-muted-foreground shrink-0"
              />
            </div>
            <div class="text-[11px] text-muted-foreground truncate">
              {{
                entry.item.disabled
                  ? entry.item.disabledReason || '暂不可用'
                  : entry.item.description
              }}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog v-model:open="customizeOpen">
    <DialogContent class="sm:max-w-lg p-4 gap-3">
      <DialogHeader>
        <DialogTitle class="text-sm">自定义快捷入口</DialogTitle>
        <DialogDescription class="text-xs">
          固定的功能会优先显示在主页快捷入口与左侧边栏「我的收藏」中；未满 8 项时自动按最近访问和常用推荐补齐。
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 min-w-0">
          <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索功能名称或说明..."
            class="pl-8"
          />
        </div>
        <Button
          v-if="favoriteItems.length > 0"
          size="xs"
          variant="ghost"
          class="text-muted-foreground hover:text-destructive shrink-0"
          @click="clearFavorites"
        >
          <Trash2 class="size-3.5" />
          清空固定
        </Button>
      </div>

      <ScrollArea class="max-h-[60vh] pr-3 [&_[data-reka-scroll-area-viewport]>div]:!block">
        <div class="space-y-4">
          <div
            v-if="favoriteItems.length > 0 && !searchKeyword.trim()"
            class="space-y-2"
          >
            <div class="flex-between">
              <span class="text-xs font-semibold text-foreground">已固定顺序</span>
              <Badge
                variant="secondary"
                size="sm"
              >
                {{ favoriteItems.length }} 项
              </Badge>
            </div>
            <div class="space-y-1">
              <div
                v-for="(item, idx) in favoriteItems"
                :key="item.key"
                class="flex-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <component
                    :is="item.icon"
                    class="size-4 shrink-0 text-foreground"
                  />
                  <span class="text-xs font-medium text-foreground truncate">{{ item.label }}</span>
                </div>
                <div class="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="none"
                    class="size-6 rounded-md flex-center"
                    :disabled="idx === 0"
                    aria-label="上移"
                    @click="moveFavorite(item.key, -1)"
                  >
                    <ArrowUp class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="none"
                    class="size-6 rounded-md flex-center"
                    :disabled="idx === favoriteItems.length - 1"
                    aria-label="下移"
                    @click="moveFavorite(item.key, 1)"
                  >
                    <ArrowDown class="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="none"
                    class="size-6 rounded-md flex-center text-amber-500 hover:bg-amber-500/15"
                    aria-label="取消固定"
                    @click="toggleFavorite(item.key)"
                  >
                    <Bookmark class="size-3.5 fill-current" />
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </div>

          <template v-if="filteredGroups.length > 0">
            <div
              v-for="group in filteredGroups"
              :key="group.id"
              class="space-y-1.5"
            >
              <div class="text-[11px] font-medium text-muted-foreground">
                {{ group.label }}
              </div>
              <div class="space-y-1">
                <div
                  v-for="item in group.items"
                  :key="item.key"
                  class="flex-between gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div
                      class="size-7 rounded-md flex-center shrink-0"
                      :class="
                        item.accent === 'brand'
                          ? 'bg-brand/10 text-brand'
                          : 'bg-muted text-foreground'
                      "
                    >
                      <component
                        :is="item.icon"
                        class="size-3.5"
                      />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-medium text-foreground truncate">
                        {{ item.label }}
                      </div>
                      <div
                        v-if="item.description"
                        class="text-[11px] text-muted-foreground truncate"
                      >
                        {{ item.description }}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="xs"
                    :variant="isFavorite(item.key) ? 'secondary' : 'outline'"
                    class="shrink-0"
                    @click="toggleFavorite(item.key)"
                  >
                    <Bookmark
                      class="size-3"
                      :class="isFavorite(item.key) ? 'text-amber-500 fill-current' : ''"
                    />
                    {{ isFavorite(item.key) ? '已固定' : '固定' }}
                  </Button>
                </div>
              </div>
            </div>
          </template>

          <Empty
            v-else
            description="没有找到匹配的功能"
          />
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
