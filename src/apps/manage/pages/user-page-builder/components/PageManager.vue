<script setup lang="ts">
import { CopyOutline, EllipsisHorizontalOutline, TrashOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NDivider,
  NDropdown,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NRadio,
  NRadioGroup,
  NTag,
  NText,
  NTooltip,
} from 'naive-ui'
import { computed, h, inject, ref } from 'vue'

import type { UserPageConfig } from '@/apps/user-page/types'

import { UserPageEditorKey } from '../context'
import { getPageModeShortLabel, PAGE_MODE_OPTIONS } from '../editorPageConfig'
import { usePageEntries } from '../usePageEntries'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const addPageModal = ref(false)
const newSlug = ref('')
const newMode = ref<UserPageConfig['mode']>('block')

const duplicatePageModal = ref(false)
const duplicateFromSlug = ref('')
const duplicateToSlug = ref('')

const deletePageModal = ref(false)
const deletePageSlug = ref('')

const pageActionOptions = [
  { label: '复制', key: 'duplicate', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
  {
    label: '删除',
    key: 'delete',
    icon: () => h(NIcon, null, { default: () => h(TrashOutline) }),
    props: { style: 'color: #d03050' },
  },
]

const { pageEntries, visiblePages, hiddenPages } = usePageEntries(editor)
const pagesCount = computed(() => pageEntries.value.length)
const canCreateMorePages = computed(() => pagesCount.value < editor.MAX_PAGES_COUNT)
const pageSections = computed(() =>
  [
    { key: 'visible', label: '子页面 · 导航显示', pages: visiblePages.value, hidden: false },
    { key: 'hidden', label: '隐藏页面 · 仅可通过按钮跳转', pages: hiddenPages.value, hidden: true },
  ].filter((section) => section.pages.length),
)

function openDuplicatePage(slug: string) {
  duplicateFromSlug.value = slug
  duplicateToSlug.value = `${slug}-copy`
  duplicatePageModal.value = true
}

function handlePageAction(key: string, slug: string) {
  if (key === 'duplicate') openDuplicatePage(slug)
  else if (key === 'delete') {
    deletePageSlug.value = slug
    deletePageModal.value = true
  }
}

function confirmDeletePage() {
  editor.removePage(deletePageSlug.value)
  deletePageModal.value = false
  deletePageSlug.value = ''
}

function createPage() {
  try {
    editor.createPage(newSlug.value, newMode.value)
    newSlug.value = ''
    newMode.value = 'block'
    addPageModal.value = false
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
      <div class="page-item">
        <div class="page-item__row">
          <NButton
            :type="editor.currentKey.value === 'home' ? 'primary' : 'default'"
            class="page-item__main"
            @click="editor.currentKey.value = 'home'"
          >
            <div class="page-item__btn-content">
              <span class="truncate-text">
                主页 /@{{ editor.account.value.name || '...' }}
              </span>
              <NTag
                size="tiny"
                :bordered="false"
                :type="editor.settings.value.home?.mode === 'block' ? 'success' : 'default'"
                class="mode-badge"
              >
                {{ getPageModeShortLabel(editor.settings.value.home?.mode ?? 'block') }}
              </NTag>
            </div>
          </NButton>
        </div>
      </div>
      <NDivider style="margin: 0" />
      <NButton
        type="info"
        :disabled="!canCreateMorePages"
        @click="addPageModal = true"
      >
        新建子页面
      </NButton>
      <NFlex vertical>
        <template
          v-for="section in pageSections"
          :key="section.key"
        >
          <NText
            depth="3"
            :style="{ fontSize: '12px', marginTop: section.hidden ? '10px' : '4px' }"
          >
            {{ section.label }}
          </NText>
          <div
            v-for="p in section.pages"
            :key="p.slug"
            class="page-item"
            :class="{ 'page-item--hidden': section.hidden }"
          >
            <div class="page-item__row">
              <NButton
                :type="editor.currentKey.value === p.slug ? 'primary' : 'default'"
                class="page-item__main"
                @click="editor.currentKey.value = p.slug"
              >
                <div class="page-item__btn-content">
                  <span class="truncate-text">
                    {{ p.title }}
                  </span>
                  <NTag
                    size="tiny"
                    :bordered="false"
                    :type="p.mode === 'block' ? 'success' : 'default'"
                    class="mode-badge"
                  >
                    {{ getPageModeShortLabel(p.mode ?? 'block') }}
                  </NTag>
                </div>
              </NButton>
              <NTooltip>
                <template #trigger>
                  <NDropdown
                    trigger="click"
                    :options="pageActionOptions"
                    @select="(key) => handlePageAction(String(key), p.slug)"
                  >
                    <NButton
                      quaternary
                      circle
                      size="small"
                      aria-label="更多页面操作"
                    >
                      <template #icon>
                        <NIcon><EllipsisHorizontalOutline /></NIcon>
                      </template>
                    </NButton>
                  </NDropdown>
                </template>
                更多页面操作
              </NTooltip>
            </div>
          </div>
        </template>
      </NFlex>
    </NFlex>

    <NModal
      v-model:show="addPageModal"
      preset="card"
      title="新建子页面"
      style="width: 480px; max-width: 90vw"
      :auto-focus="false"
    >
      <NForm
        size="small"
        label-placement="top"
      >
        <NFormItem
          label="页面链接标识 (Slug)"
          required
        >
          <NInput
            v-model:value="newSlug"
            placeholder="例如 links / sponsor / faq（仅限字母、数字、短横线）"
          />
        </NFormItem>
        <NFormItem label="搭建模式">
          <NRadioGroup
            v-model:value="newMode"
            name="new-page-mode"
            style="width: 100%"
          >
            <NFlex
              vertical
              :size="8"
            >
              <NRadio
                v-for="opt in PAGE_MODE_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                <span style="font-weight: 500">{{ opt.label }}</span>
                <NTag
                  v-if="opt.tag"
                  size="tiny"
                  type="success"
                  :bordered="false"
                  style="margin-left: 6px"
                >
                  {{ opt.tag }}
                </NTag>
                <div style="font-size: 12px; color: var(--vtsuru-fg-muted); margin-top: 2px">
                  {{ opt.description }}
                </div>
              </NRadio>
            </NFlex>
          </NRadioGroup>
        </NFormItem>
        <NAlert
          type="info"
          :show-icon="true"
        >
          创建后访问地址：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
        </NAlert>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="addPageModal = false"> 取消 </NButton>
          <NButton
            type="primary"
            :disabled="!newSlug.trim().length"
            @click="createPage"
          >
            创建
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
      <NForm
        size="small"
        label-placement="top"
      >
        <NAlert
          type="info"
          :show-icon="true"
        >
          复制自：/{{ duplicateFromSlug || 'slug' }}
        </NAlert>
        <NFormItem
          label="新页面标识 (Slug)"
          required
        >
          <NInput
            v-model:value="duplicateToSlug"
            placeholder="例如 links-copy"
          />
        </NFormItem>
        <NText depth="3"> 会自动为复制后的页面生成新的区块 ID，避免与原页面冲突。 </NText>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="duplicatePageModal = false"> 取消 </NButton>
          <NButton
            type="primary"
            :disabled="!duplicateToSlug.trim().length"
            @click="confirmDuplicatePage"
          >
            确定
          </NButton>
        </NFlex>
      </template>
    </NModal>

    <NModal
      v-model:show="deletePageModal"
      preset="dialog"
      type="error"
      title="删除子页面"
      :content="`将删除 /${deletePageSlug} 及其中全部配置，此操作可通过撤销恢复。`"
      positive-text="删除"
      negative-text="取消"
      @positive-click="confirmDeletePage"
    />
  </div>
</template>

<style scoped src="./ui-transitions.css"></style>

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

.page-item__main :deep(.n-button__content) {
  width: 100%;
}

.page-item__btn-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 4px;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  text-align: left;
}

.mode-badge {
  flex: none;
  font-size: 11px;
  pointer-events: none;
}
</style>
