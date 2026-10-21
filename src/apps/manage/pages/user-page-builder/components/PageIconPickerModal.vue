<script setup lang="ts">
import { SearchOutline } from '@vicons/ionicons5'
import { useElementSize } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  COMMON_USER_PAGE_NAV_ICON_NAMES,
  getUserPageNavIconLabel,
  getUserPageNavIconSearchText,
  resolveUserPageNavIcon,
} from '@/apps/user-page/pageIcons'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'

type IconStyle = 'common' | 'all' | 'outline' | 'filled' | 'sharp' | 'logo'

interface IconRow {
  key: string
  icons: string[]
}

const props = defineProps<{ value?: string }>()
const emit = defineEmits<{
  select: [value: string | undefined]
}>()
const show = defineModel<boolean>('show', { required: true })

const search = ref('')
const styleFilter = ref<IconStyle>('common')
const loading = ref(false)
const loadError = ref('')
const iconNames = shallowRef<readonly string[]>([])
const iconGridHost = ref<HTMLElement | null>(null)
const { width: gridWidth } = useElementSize(iconGridHost)

const columns = computed(() => Math.max(3, Math.min(9, Math.floor((gridWidth.value + 8) / 82))))

function getIconStyle(name: string): Exclude<IconStyle, 'all' | 'common'> {
  if (name.startsWith('Logo')) return 'logo'
  if (name.endsWith('Outline')) return 'outline'
  if (name.endsWith('Sharp')) return 'sharp'
  return 'filled'
}

const commonIconNames = new Set(COMMON_USER_PAGE_NAV_ICON_NAMES)

const styleOptions = computed(() => {
  const counts = { outline: 0, filled: 0, sharp: 0, logo: 0 }
  iconNames.value.forEach((name) => counts[getIconStyle(name)]++)
  return [
    { label: `常用 ${COMMON_USER_PAGE_NAV_ICON_NAMES.length}`, value: 'common' as const },
    { label: `全部 ${iconNames.value.length}`, value: 'all' as const },
    { label: `描边 ${counts.outline}`, value: 'outline' as const },
    { label: `实心 ${counts.filled}`, value: 'filled' as const },
    { label: `Sharp ${counts.sharp}`, value: 'sharp' as const },
    { label: `品牌 ${counts.logo}`, value: 'logo' as const },
  ]
})

const filteredIconNames = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  return iconNames.value.filter(
    (name) =>
      (styleFilter.value === 'all' ||
        (styleFilter.value === 'common' ? commonIconNames.has(name) : getIconStyle(name) === styleFilter.value)) &&
      (!keyword || getUserPageNavIconSearchText(name).includes(keyword)),
  )
})

const iconRows = computed<IconRow[]>(() => {
  const rows: IconRow[] = []
  for (let index = 0; index < filteredIconNames.value.length; index += columns.value) {
    const icons = filteredIconNames.value.slice(index, index + columns.value)
    rows.push({ key: `${columns.value}:${icons[0]}`, icons })
  }
  return rows
})

async function loadCatalog() {
  if (iconNames.value.length || loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const { USER_PAGE_NAV_ICON_NAMES } = await import('@/apps/user-page/pageIconLoaders')
    iconNames.value = USER_PAGE_NAV_ICON_NAMES
  } catch (error) {
    loadError.value = (error as Error).message || String(error)
  } finally {
    loading.value = false
  }
}

function selectIcon(value: string | undefined) {
  emit('select', value)
  show.value = false
}

watch(show, (visible) => {
  if (visible) void loadCatalog()
})
</script>

<template>
  <Dialog :open="show" @update:open="(val) => (show = val)">
    <DialogContent class="max-w-[min(860px,94vw)] p-6">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold"> 选择导航图标 </DialogTitle>
      </DialogHeader>

      <div class="page-icon-picker space-y-3">
        <div class="relative">
          <SearchOutline class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" class="pl-8 text-xs h-8" placeholder="搜索图标名称" />
        </div>

        <div class="style-filter-scroll">
          <div class="inline-flex rounded-lg border bg-muted p-0.5 text-muted-foreground text-xs">
            <button
              v-for="option in styleOptions"
              :key="option.value"
              type="button"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all"
              :class="styleFilter === option.value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'"
              @click="styleFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div ref="iconGridHost" class="icon-grid-host overflow-y-auto">
          <div v-if="iconRows.length" class="icon-grid-list space-y-2 p-2">
            <div
              v-for="row in iconRows"
              :key="row.key"
              class="icon-grid-row"
              :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
            >
              <button
                v-for="icon in row.icons"
                :key="icon"
                type="button"
                class="icon-option flex flex-col items-center justify-center p-2 rounded-md hover:bg-muted/70 transition-colors border border-transparent"
                :class="{ 'icon-option--selected !border-primary bg-primary/10 text-primary': icon === props.value }"
                :aria-label="getUserPageNavIconLabel(icon)"
                :aria-pressed="icon === props.value"
                @click="selectIcon(icon)"
              >
                <component :is="resolveUserPageNavIcon(icon)" class="size-6 shrink-0 mb-1" />
                <span class="text-[11px] truncate w-full text-center">{{ getUserPageNavIconLabel(icon) }}</span>
              </button>
            </div>
          </div>
          <div v-else-if="loading" class="picker-state h-full flex items-center justify-center">
            <Spin />
          </div>
          <div v-else-if="loadError" class="picker-state h-full flex items-center justify-center text-xs text-destructive">
            {{ loadError }}
          </div>
          <div v-else class="picker-state h-full flex items-center justify-center text-xs text-muted-foreground">
            未找到匹配图标
          </div>
        </div>
      </div>

      <DialogFooter class="flex flex-row justify-between items-center sm:justify-between pt-2">
        <Button variant="outline" size="sm" @click="selectIcon(undefined)"> 使用默认图标 </Button>
        <Button variant="outline" size="sm" @click="show = false"> 取消 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.style-filter-scroll {
  overflow-x: auto;
  padding-bottom: 2px;
}

.icon-grid-host {
  min-width: 0;
  height: min(58vh, 528px);
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--muted);
}

.icon-grid-row {
  display: grid;
  gap: 8px;
  min-height: 76px;
}
</style>
