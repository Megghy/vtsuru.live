<script setup lang="ts">
import { SearchOutline } from '@vicons/ionicons5'
import { useElementSize } from '@vueuse/core'
import {
  NButton,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSpin,
  NText,
  NVirtualList,
} from 'naive-ui'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  COMMON_USER_PAGE_NAV_ICON_NAMES,
  getUserPageNavIconLabel,
  getUserPageNavIconSearchText,
  resolveUserPageNavIcon,
} from '@/apps/user-page/pageIcons'

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
    { label: `常用 ${COMMON_USER_PAGE_NAV_ICON_NAMES.length}`, value: 'common' },
    { label: `全部 ${iconNames.value.length}`, value: 'all' },
    { label: `描边 ${counts.outline}`, value: 'outline' },
    { label: `实心 ${counts.filled}`, value: 'filled' },
    { label: `Sharp ${counts.sharp}`, value: 'sharp' },
    { label: `品牌 ${counts.logo}`, value: 'logo' },
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
  <NModal
    v-model:show="show"
    preset="card"
    title="选择导航图标"
    class="page-icon-picker-modal"
    style="width: min(860px, 94vw)"
    :auto-focus="false"
  >
    <div class="page-icon-picker">
      <NInput
        v-model:value="search"
        clearable
        placeholder="搜索图标名称"
      >
        <template #prefix>
          <NIcon :component="SearchOutline" />
        </template>
      </NInput>

      <div class="style-filter-scroll">
        <NRadioGroup
          v-model:value="styleFilter"
          size="small"
          class="style-filter"
        >
          <NRadioButton
            v-for="option in styleOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div
        ref="iconGridHost"
        class="icon-grid-host"
      >
        <NVirtualList
          v-if="iconRows.length"
          class="icon-grid-list"
          :items="iconRows"
          :item-size="88"
          key-field="key"
        >
          <template #default="{ item }">
            <div
              class="icon-grid-row"
              :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
            >
              <button
                v-for="icon in item.icons"
                :key="icon"
                type="button"
                class="icon-option"
                :class="{ 'icon-option--selected': icon === props.value }"
                :aria-label="getUserPageNavIconLabel(icon)"
                :aria-pressed="icon === props.value"
                @click="selectIcon(icon)"
              >
                <NIcon
                  :component="resolveUserPageNavIcon(icon)"
                  :size="27"
                />
                <span>{{ getUserPageNavIconLabel(icon) }}</span>
              </button>
            </div>
          </template>
        </NVirtualList>
        <div
          v-else-if="loading"
          class="picker-state"
        >
          <NSpin size="small" />
        </div>
        <div
          v-else-if="loadError"
          class="picker-state"
        >
          <NText type="error">{{ loadError }}</NText>
        </div>
        <NEmpty
          v-else
          class="picker-state"
          size="small"
        />
      </div>
    </div>

    <template #footer>
      <NFlex justify="space-between">
        <NButton @click="selectIcon(undefined)"> 使用默认图标 </NButton>
        <NButton @click="show = false"> 取消 </NButton>
      </NFlex>
    </template>
  </NModal>
</template>

<style scoped>
.page-icon-picker {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.style-filter-scroll {
  overflow-x: auto;
  padding-bottom: 2px;
}

.style-filter {
  display: flex;
  min-width: max-content;
}

.icon-grid-host {
  min-width: 0;
  height: min(58vh, 528px);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-inset);
  overflow: hidden;
}

.icon-grid-list {
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
}

.icon-grid-row {
  display: grid;
  gap: 8px;
  height: 88px;
}

.icon-option {
  display: grid;
  grid-template-rows: 32px minmax(0, 1fr);
  place-items: center;
  gap: 4px;
  min-width: 0;
  height: 80px;
  padding: 7px 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--vtsuru-fg);
  background: transparent;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

.icon-option:hover {
  color: var(--vtsuru-brand);
  border-color: var(--vtsuru-border-strong);
  background: var(--vtsuru-bg-muted);
}

.icon-option--selected {
  color: var(--vtsuru-brand);
  border-color: var(--vtsuru-brand);
  background: var(--vtsuru-brand-tint);
}

.icon-option span {
  display: -webkit-box;
  overflow: hidden;
  max-width: 100%;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.25;
  font-size: 11px;
  text-align: center;
  overflow-wrap: anywhere;
}

.picker-state {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
}

@media (max-width: 480px) {
  .icon-grid-host {
    height: min(56vh, 440px);
  }

  .icon-grid-list {
    padding: 6px;
  }

  .icon-grid-row {
    gap: 6px;
  }
}
</style>
