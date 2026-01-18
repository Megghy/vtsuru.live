<script setup lang="ts">
import { NAlert, NButton, NDivider, NDropdown, NFlex, NIcon, NInput, NInputNumber, NModal, NSwitch, NText } from 'naive-ui';
import { computed, h, inject, ref } from 'vue'
import { ChevronDownOutline, ChevronUpOutline, CopyOutline, CreateOutline, EllipsisHorizontalOutline, TrashOutline } from '@vicons/ionicons5'
import { UserPageEditorKey } from '../context'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const expandedSlugs = ref<Record<string, boolean>>({})

const addPageModal = ref(false)
const newSlug = ref('')

const renamePageModal = ref(false)
const renameFromSlug = ref('')
const renameToSlug = ref('')

const duplicatePageModal = ref(false)
const duplicateFromSlug = ref('')
const duplicateToSlug = ref('')

const pageActionOptions = [
  { label: '重命名', key: 'rename', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
  { label: '复制', key: 'duplicate', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
  { label: '删除', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), props: { style: 'color: #d03050' } },
]

const pagesCount = computed(() => Object.keys(editor.settings.value.pages ?? {}).length)
const canCreateMorePages = computed(() => pagesCount.value < editor.MAX_PAGES_COUNT)

type PageEntry = { slug: string, navVisible: boolean, navOrder: number, title: string }
const pageEntries = computed<PageEntry[]>(() => {
  const pages = editor.settings.value.pages ?? {}
  return Object.entries(pages)
    .map(([slug, cfg]) => ({
      slug,
      navVisible: (cfg as any)?.navVisible !== false,
      navOrder: typeof (cfg as any)?.navOrder === 'number' ? (cfg as any).navOrder : 0,
      title: editor.getPageLabel(slug),
    }))
    .sort((a, b) => (a.navOrder - b.navOrder) || a.slug.localeCompare(b.slug))
})

const visiblePages = computed(() => pageEntries.value.filter(p => p.navVisible))
const hiddenPages = computed(() => pageEntries.value.filter(p => !p.navVisible))

function isExpanded(slug: string) {
  return expandedSlugs.value[slug] === true
}

function toggleExpanded(slug: string) {
  expandedSlugs.value = { ...expandedSlugs.value, [slug]: !isExpanded(slug) }
}

function getPageConfig(slug: string): any | null {
  const pages = editor.settings.value.pages ?? {}
  return (pages as any)[slug] ?? null
}

function getPageTitle(slug: string) {
  const cfg = getPageConfig(slug)
  const v = cfg?.title
  return typeof v === 'string' ? v : ''
}

function setPageTitle(slug: string, v: unknown) {
  const cfg = getPageConfig(slug)
  if (!cfg) return
  const s = String(v ?? '').trim()
  if (!s.length) delete cfg.title
  else cfg.title = s.slice(0, 50)
}

function getPageNavVisible(slug: string) {
  const cfg = getPageConfig(slug)
  return cfg?.navVisible !== false
}

function setPageNavVisible(slug: string, v: boolean) {
  const cfg = getPageConfig(slug)
  if (!cfg) return
  if (v) delete cfg.navVisible
  else cfg.navVisible = false
}

function getPageNavOrder(slug: string) {
  const cfg = getPageConfig(slug)
  const v = cfg?.navOrder
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function setPageNavOrder(slug: string, v: number | null) {
  const cfg = getPageConfig(slug)
  if (!cfg) return
  const next = Number(v ?? 0)
  if (!Number.isFinite(next) || next === 0) delete cfg.navOrder
  else cfg.navOrder = next
}

function openRenamePage(slug: string) {
  renameFromSlug.value = slug
  renameToSlug.value = slug
  renamePageModal.value = true
}

function openDuplicatePage(slug: string) {
  duplicateFromSlug.value = slug
  duplicateToSlug.value = `${slug}-copy`
  duplicatePageModal.value = true
}

function handlePageAction(key: string, slug: string) {
  if (key === 'rename') openRenamePage(slug)
  else if (key === 'duplicate') openDuplicatePage(slug)
  else if (key === 'delete') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`确定要删除页面 /${slug} 吗？`)) editor.removePage(slug)
  }
}

function createPage() {
  try {
    editor.createPage(newSlug.value)
    newSlug.value = ''
    addPageModal.value = false
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

function confirmRenamePage() {
  try {
    editor.renamePage(renameFromSlug.value, renameToSlug.value)
    renamePageModal.value = false
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

function confirmDuplicatePage() {
  try {
    editor.duplicatePage(duplicateFromSlug.value, duplicateToSlug.value)
    duplicatePageModal.value = false
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}
</script>

<template>
  <div>
    <NFlex vertical>
      <NButton
        type="primary"
        @click="editor.currentKey.value = 'home'"
      >
        主页 /@{{ editor.account.value.name || '...' }}
      </NButton>
      <NDivider style="margin: 0" />
      <NButton
        type="info"
        :disabled="!canCreateMorePages"
        @click="addPageModal = true"
      >
        新建子页面
      </NButton>
      <NFlex vertical>
        <template v-if="visiblePages.length">
          <NText depth="3" style="font-size: 12px; margin-top: 4px">
            子页面 · 导航显示
          </NText>
          <div
            v-for="p in visiblePages"
            :key="p.slug"
            class="page-item"
          >
            <div class="page-item__row">
              <NButton
                :type="editor.currentKey.value === p.slug ? 'primary' : 'default'"
                class="page-item__main"
                @click="editor.currentKey.value = p.slug"
              >
                <span class="truncate-text">
                  {{ p.title }}
                </span>
              </NButton>
              <NButton quaternary circle size="small" @click="toggleExpanded(p.slug)">
                <template #icon>
                  <NIcon>
                    <ChevronUpOutline v-if="isExpanded(p.slug)" />
                    <ChevronDownOutline v-else />
                  </NIcon>
                </template>
              </NButton>
              <NDropdown
                trigger="click"
                :options="pageActionOptions"
                @select="(key) => handlePageAction(String(key), p.slug)"
              >
                <NButton quaternary circle size="small">
                  <template #icon>
                    <NIcon><EllipsisHorizontalOutline /></NIcon>
                  </template>
                </NButton>
              </NDropdown>
            </div>
            <div v-if="isExpanded(p.slug)" class="page-item__expand">
              <NFlex justify="space-between" align="center" :wrap="false" style="gap: 10px">
                <NText depth="3" style="font-size: 12px">
                  显示在侧边栏
                </NText>
                <NSwitch :value="getPageNavVisible(p.slug)" size="small" @update:value="(v) => setPageNavVisible(p.slug, v)" />
              </NFlex>
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                页面名称 · 可选
              </NText>
              <NInput
                size="small"
                placeholder="用于管理列表展示"
                :value="getPageTitle(p.slug)"
                @update:value="(v) => setPageTitle(p.slug, v)"
              />
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                排序权重 · 数字越小越靠前
              </NText>
              <NInputNumber
                size="small"
                style="width: 100%"
                :value="getPageNavOrder(p.slug)"
                @update:value="(v) => setPageNavOrder(p.slug, v)"
              />
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px">
                模式：{{ editor.getPageModeLabel(getPageConfig(p.slug)?.mode) }}
              </NText>
            </div>
          </div>
        </template>

        <template v-if="hiddenPages.length">
          <NText depth="3" style="font-size: 12px; margin-top: 10px">
            隐藏页面 · 仅可通过按钮跳转
          </NText>
          <div
            v-for="p in hiddenPages"
            :key="p.slug"
            class="page-item page-item--hidden"
          >
            <div class="page-item__row">
              <NButton
                :type="editor.currentKey.value === p.slug ? 'primary' : 'default'"
                class="page-item__main"
                @click="editor.currentKey.value = p.slug"
              >
                <span class="truncate-text">
                  {{ p.title }}
                </span>
              </NButton>
              <NButton quaternary circle size="small" @click="toggleExpanded(p.slug)">
                <template #icon>
                  <NIcon>
                    <ChevronUpOutline v-if="isExpanded(p.slug)" />
                    <ChevronDownOutline v-else />
                  </NIcon>
                </template>
              </NButton>
              <NDropdown
                trigger="click"
                :options="pageActionOptions"
                @select="(key) => handlePageAction(String(key), p.slug)"
              >
                <NButton quaternary circle size="small">
                  <template #icon>
                    <NIcon><EllipsisHorizontalOutline /></NIcon>
                  </template>
                </NButton>
              </NDropdown>
            </div>
            <div v-if="isExpanded(p.slug)" class="page-item__expand">
              <NFlex justify="space-between" align="center" :wrap="false" style="gap: 10px">
                <NText depth="3" style="font-size: 12px">
                  显示在侧边栏
                </NText>
                <NSwitch :value="getPageNavVisible(p.slug)" size="small" @update:value="(v) => setPageNavVisible(p.slug, v)" />
              </NFlex>
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                页面名称 · 可选
              </NText>
              <NInput
                size="small"
                placeholder="用于管理列表展示"
                :value="getPageTitle(p.slug)"
                @update:value="(v) => setPageTitle(p.slug, v)"
              />
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 6px">
                排序权重 · 数字越小越靠前
              </NText>
              <NInputNumber
                size="small"
                style="width: 100%"
                :value="getPageNavOrder(p.slug)"
                @update:value="(v) => setPageNavOrder(p.slug, v)"
              />
              <div style="height: 8px" />
              <NText depth="3" style="font-size: 12px">
                模式：{{ editor.getPageModeLabel(getPageConfig(p.slug)?.mode) }}
              </NText>
            </div>
          </div>
        </template>
      </NFlex>
    </NFlex>

    <NModal
      v-model:show="addPageModal"
      preset="card"
      title="新建子页面"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NForm size="small" label-placement="top">
        <NFormItem label="slug" required>
          <NInput v-model:value="newSlug" placeholder="例如 links / sponsor / faq" />
        </NFormItem>
        <NAlert type="info" :show-icon="true">
          创建后可访问：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
        </NAlert>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="addPageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="createPage">
            创建
          </NButton>
        </NFlex>
      </template>
    </NModal>

    <NModal
      v-model:show="renamePageModal"
      preset="card"
      title="重命名子页面 slug"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NForm size="small" label-placement="top">
        <NAlert type="info" :show-icon="true">
          原 slug：/{{ renameFromSlug || 'slug' }}
        </NAlert>
        <NFormItem label="新 slug" required>
          <NInput v-model:value="renameToSlug" placeholder="例如 links / sponsor / faq" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="renamePageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="confirmRenamePage">
            确定
          </NButton>
        </NFlex>
      </template>
    </NModal>

    <NModal
      v-model:show="duplicatePageModal"
      preset="card"
      title="复制子页面"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NForm size="small" label-placement="top">
        <NAlert type="info" :show-icon="true">
          复制自：/{{ duplicateFromSlug || 'slug' }}
        </NAlert>
        <NFormItem label="新 slug" required>
          <NInput v-model:value="duplicateToSlug" placeholder="例如 links-copy" />
        </NFormItem>
        <NText depth="3">
          会自动为区块页生成新的 block.id，避免与原页面冲突。
        </NText>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="duplicatePageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="confirmDuplicatePage">
            确定
          </NButton>
        </NFlex>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.page-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-item--hidden {
  opacity: 0.92;
}

.page-item__row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.page-item__main {
  flex: 1;
  min-width: 0;
}

.page-item__expand {
  border: 1px solid var(--n-divider-color);
  border-radius: 10px;
  padding: 10px;
  background: var(--n-color-embedded);
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
