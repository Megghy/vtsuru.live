<script setup lang="ts">
import { computed, inject, ref } from 'vue'

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
  { label: '复制', key: 'duplicate', icon: 'i-lucide-copy' },
  {
    label: '删除',
    key: 'delete',
    icon: 'i-lucide-trash-2',
    class: 'text-red-500',
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
    <div class="builder-stack">
      <UButton
        color="primary"
        @click="editor.currentKey.value = 'home'"
      >
        主页 /@{{ editor.account.value.name || '...' }}
      </UButton>
      <USeparator style="margin: 0" />
      <UButton
        color="info"
        :disabled="!canCreateMorePages"
        @click="addPageModal = true"
      >
        新建子页面
      </UButton>
      <div class="builder-stack">
        <template
          v-for="section in pageSections"
          :key="section.key"
        >
          <span
            class="builder-text"
            :style="{ fontSize: '12px', marginTop: section.hidden ? '10px' : '4px' }"
          >
            {{ section.label }}
          </span>
          <div
            v-for="p in section.pages"
            :key="p.slug"
            class="page-item"
            :class="{ 'page-item--hidden': section.hidden }"
          >
            <div class="page-item__row">
              <UButton
                :color="editor.currentKey.value === p.slug ? 'primary' : 'default'"
                class="page-item__main"
                @click="editor.currentKey.value = p.slug"
              >
                <span class="truncate-text">
                  {{ p.title }}
                </span>
              </UButton>
              <UTooltip>
                <UDropdownMenu
                  :items="
                    pageActionOptions.map((item) => ({ ...item, onSelect: () => handlePageAction(item.key, p.slug) }))
                  "
                >
                  <UButton
                    variant="ghost"
                    square
                    size="sm"
                    aria-label="更多页面操作"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-ellipsis" />
                    </template>
                  </UButton>
                </UDropdownMenu>
                <template #content> 更多页面操作 </template></UTooltip
              >
            </div>
          </div>
        </template>
      </div>
    </div>

    <UModal
      v-model:open="addPageModal"
      title="新建子页面"
      style="width: 420px; max-width: 90vw"
    >
      <template #body
        ><div class="builder-form">
          <UFormField
            label="slug"
            required
          >
            <UInput
              v-model="newSlug"
              placeholder="例如 links / sponsor / faq"
            />
          </UFormField>
          <UAlert
            type="info"
            :show-icon="true"
          >
            创建后可访问：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
          </UAlert>
        </div></template
      >
      <template #footer>
        <div class="builder-row">
          <UButton @click="addPageModal = false"> 取消 </UButton>
          <UButton
            color="primary"
            @click="createPage"
          >
            创建
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="duplicatePageModal"
      title="复制子页面"
      style="width: 420px; max-width: 90vw"
    >
      <template #body
        ><div class="builder-form">
          <UAlert
            type="info"
            :show-icon="true"
          >
            复制自：/{{ duplicateFromSlug || 'slug' }}
          </UAlert>
          <UFormField
            label="新 slug"
            required
          >
            <UInput
              v-model="duplicateToSlug"
              placeholder="例如 links-copy"
            />
          </UFormField>
          <span class="builder-text"> 会自动为区块页生成新的 block.id，避免与原页面冲突。 </span>
        </div></template
      >
      <template #footer>
        <div class="builder-row">
          <UButton @click="duplicatePageModal = false"> 取消 </UButton>
          <UButton
            color="primary"
            @click="confirmDuplicatePage"
          >
            确定
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deletePageModal"
      title="删除子页面"
    >
      <template #body>将删除 /{{ deletePageSlug }} 及其中全部区块，此操作可通过撤销恢复。</template>
      <template #footer>
        <div class="builder-row modal-actions">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            @click="deletePageModal = false"
          />
          <UButton
            label="删除"
            color="error"
            @click="confirmDeletePage"
          />
        </div>
      </template>
    </UModal>
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
