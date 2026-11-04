<script setup lang="ts">
import { EyeOff16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import { formatClock } from '../core/format'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import EventBadges from './EventBadges.vue'
import EventMessage from './EventMessage.vue'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const grid = computed(() => dashboard.cardGrid)
const victim = computed(() => grid.value.nextVictim())
</script>

<template>
  <div
    class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] auto-rows-[minmax(72px,auto)] gap-1.5 p-1.5 overflow-y-auto h-full box-border content-start"
  >
    <div
      v-for="(card, index) in grid.slots"
      :key="index"
      class="group/slot border border-border rounded-md bg-popover py-1.5 px-2 transition-opacity duration-300 min-w-0"
      :class="{ 'opacity-45': index === victim, 'border-dashed bg-transparent': !card }"
      @mouseenter="grid.protectedIndex = index"
      @mouseleave="grid.protectedIndex = undefined"
      @contextmenu="card && ui.openContextMenu(card.display, $event)"
    >
      <template v-if="card">
        <div class="flex items-center gap-1 text-[0.8em] text-muted-foreground">
          <EventBadges
            :event="card.display"
            :show-medal="false"
          />
          <Button
            variant="ghost"
            size="xs"
            class="h-auto p-0 min-w-0 max-w-full justify-start text-muted-foreground text-[0.8em] font-normal"
            data-user-trigger
            @click.stop="ui.openUserMenu(card.display, $event)"
          >
            <span class="truncate">{{ card.display.uname }}</span>
          </Button>
          <Popover v-if="card.count > 1">
            <PopoverTrigger as-child>
              <Button
                variant="secondary"
                size="xs"
                class="h-auto py-0.5 px-1.5 ml-auto rounded-full font-semibold text-[0.8em]"
              >
                ×{{ card.count }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="max-h-[280px] overflow-y-auto p-2 w-auto">
              <div class="grid gap-1 text-xs min-w-[200px]">
                <div
                  v-for="[key, user] in [...card.users].sort((a, b) => b[1].count - a[1].count)"
                  :key="key"
                  class="flex-between gap-3"
                >
                  <span>{{ user.uname }}</span>
                  <span>×{{ user.count }} · {{ formatClock(user.lastAt) }}</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon-xs"
            class="size-5 p-0 opacity-0 group-hover/slot:opacity-80 ml-auto text-muted-foreground"
            aria-label="隐藏这条弹幕"
            @click="grid.hide(index)"
          >
            <component
              :is="EyeOff16Regular"
              class="size-3"
            />
          </Button>
        </div>
        <div class="mt-1 font-semibold wrap-anywhere">
          <EventMessage
            :msg="card.display.msg"
            :emoji="card.display.emoji"
          />
          <div
            v-if="ui.translations.has(card.display.key)"
            class="mt-0.5 text-[0.85em] font-normal text-muted-foreground"
          >
            {{ ui.translations.get(card.display.key) }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
