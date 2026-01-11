<script setup lang="ts">
import { NAlert, NButton, NDivider, NDropdown, NIcon, NInput, NModal, NSpace, NText } from 'naive-ui'
import { computed, h, inject, ref } from 'vue'
import { CopyOutline, CreateOutline, EllipsisHorizontalOutline, TrashOutline } from '@vicons/ionicons5'
import { UserPageEditorKey } from '../context'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

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
    <NSpace vertical>
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
      <NSpace vertical>
        <div
          v-for="slug in Object.keys(editor.settings.value.pages ?? {})"
          :key="slug"
          style="display: flex; gap: 4px; align-items: center"
        >
          <NButton
            :type="editor.currentKey.value === slug ? 'primary' : 'default'"
            style="flex: 1; min-width: 0"
            @click="editor.currentKey.value = slug"
          >
            <span class="truncate-text">
              {{ editor.getPageLabel(slug) }}
            </span>
          </NButton>
          <NDropdown
            trigger="click"
            :options="pageActionOptions"
            @select="(key) => handlePageAction(String(key), slug)"
          >
            <NButton quaternary circle size="small">
              <template #icon>
                <NIcon><EllipsisHorizontalOutline /></NIcon>
              </template>
            </NButton>
          </NDropdown>
        </div>
      </NSpace>
    </NSpace>

    <NModal
      v-model:show="addPageModal"
      preset="card"
      title="新建子页面"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NSpace vertical>
        <NInput v-model:value="newSlug" placeholder="slug，例如 links / sponsor / faq" />
        <NAlert type="info" :show-icon="true">
          创建后可访问：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
        </NAlert>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="addPageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="createPage">
            创建
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="renamePageModal"
      preset="card"
      title="重命名子页面 slug"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NSpace vertical>
        <NAlert type="info" :show-icon="true">
          原 slug：/{{ renameFromSlug || 'slug' }}
        </NAlert>
        <NInput v-model:value="renameToSlug" placeholder="新 slug，例如 links / sponsor / faq" />
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="renamePageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="confirmRenamePage">
            确定
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="duplicatePageModal"
      preset="card"
      title="复制子页面"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NSpace vertical>
        <NAlert type="info" :show-icon="true">
          复制自：/{{ duplicateFromSlug || 'slug' }}
        </NAlert>
        <NInput v-model:value="duplicateToSlug" placeholder="新 slug，例如 links-copy" />
        <NText depth="3">
          会自动为区块页生成新的 block.id，避免与原页面冲突。
        </NText>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="duplicatePageModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="confirmDuplicatePage">
            确定
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
