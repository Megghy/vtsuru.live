<script setup lang="ts">
import { CopyOutline, EllipsisHorizontalOutline, TrashOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NDivider, NDropdown, NFlex, NIcon, NInput, NModal, NText, NTooltip } from 'naive-ui'
import { computed, h, inject, ref } from 'vue'

import { UserPageEditorKey } from '../context'
import { usePageEntries } from '../usePageEntries'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const addPageModal = ref(false)
const newSlug = ref('')

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
    editor.createPage(newSlug.value)
    newSlug.value = ''
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
                <span class="truncate-text">
                  {{ p.title }}
                </span>
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
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NForm
        size="small"
        label-placement="top"
      >
        <NFormItem
          label="slug"
          required
        >
          <NInput
            v-model:value="newSlug"
            placeholder="例如 links / sponsor / faq"
          />
        </NFormItem>
        <NAlert
          type="info"
          :show-icon="true"
        >
          创建后可访问：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
        </NAlert>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="addPageModal = false"> 取消 </NButton>
          <NButton
            type="primary"
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
          label="新 slug"
          required
        >
          <NInput
            v-model:value="duplicateToSlug"
            placeholder="例如 links-copy"
          />
        </NFormItem>
        <NText depth="3"> 会自动为区块页生成新的 block.id，避免与原页面冲突。 </NText>
      </NForm>
      <template #footer>
        <NFlex justify="end">
          <NButton @click="duplicatePageModal = false"> 取消 </NButton>
          <NButton
            type="primary"
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
      :content="`将删除 /${deletePageSlug} 及其中全部区块，此操作可通过撤销恢复。`"
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

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
