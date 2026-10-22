<script setup lang="ts">
import { EyeOff16Regular } from '@vicons/fluent'
import { computed } from 'vue'

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
  <div class="card-grid">
    <div
      v-for="(card, index) in grid.slots"
      :key="index"
      class="card-slot"
      :class="{ 'card-slot--victim': index === victim, 'card-slot--empty': !card }"
      @mouseenter="grid.protectedIndex = index"
      @mouseleave="grid.protectedIndex = undefined"
      @contextmenu="card && ui.openContextMenu(card.display, $event)"
    >
      <template v-if="card">
        <div class="card-slot__head">
          <EventBadges
            :event="card.display"
            :show-medal="false"
          />
          <button
            class="card-slot__name"
            data-user-trigger
            type="button"
            @click.stop="ui.openUserMenu(card.display, $event)"
          >
            {{ card.display.uname }}
          </button>
          <Popover v-if="card.count > 1">
            <PopoverTrigger as-child>
              <button
                class="card-slot__count"
                type="button"
              >
                ×{{ card.count }}
              </button>
            </PopoverTrigger>
            <PopoverContent class="max-h-[280px] overflow-y-auto p-2 w-auto">
              <div class="card-users">
                <div
                  v-for="[key, user] in [...card.users].sort((a, b) => b[1].count - a[1].count)"
                  :key="key"
                  class="card-users__row"
                >
                  <span>{{ user.uname }}</span>
                  <span>×{{ user.count }} · {{ formatClock(user.lastAt) }}</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            class="card-slot__hide"
            type="button"
            title="隐藏这条弹幕（刷新后恢复）"
            @click="grid.hide(index)"
          >
            <component
              :is="EyeOff16Regular"
              class="h-4 w-4"
            />
          </button>
        </div>
        <div class="card-slot__body">
          <EventMessage
            :msg="card.display.msg"
            :emoji="card.display.emoji"
          />
          <div
            v-if="ui.translations.has(card.display.key)"
            class="card-slot__translation"
          >
            {{ ui.translations.get(card.display.key) }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  grid-auto-rows: minmax(72px, auto);
  gap: 6px;
  padding: 6px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
  align-content: start;
}

.card-slot {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--popover);
  padding: 6px 8px;
  transition: opacity 0.3s ease;
  min-width: 0;
}

.card-slot--empty {
  border-style: dashed;
  background: transparent;
}

.card-slot--victim {
  opacity: 0.45;
}

.card-slot__head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8em;
  color: var(--muted-foreground);
}

.card-slot__name {
  all: unset;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.card-slot__count {
  all: unset;
  cursor: pointer;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}

.card-slot__hide {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  opacity: 0;
}

.card-slot:hover .card-slot__hide {
  opacity: 0.8;
}

.card-slot__count + .card-slot__hide,
.card-slot__name + .card-slot__hide {
  margin-left: auto;
}

.card-slot__count + .card-slot__hide {
  margin-left: 0;
}

.card-slot__body {
  margin-top: 4px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.card-slot__translation {
  margin-top: 2px;
  font-size: 0.85em;
  font-weight: 400;
  color: var(--muted-foreground);
}

.card-users {
  display: grid;
  gap: 4px;
  font-size: 12px;
  min-width: 200px;
}

.card-users__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>
