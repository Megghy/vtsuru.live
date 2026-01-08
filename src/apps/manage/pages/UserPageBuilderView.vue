<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NAlert, NButton, NCard, NColorPicker, NDivider, NFlex, NForm, NFormItem, NInput, NInputNumber, NModal, NPopconfirm, NRadioButton, NRadioGroup, NScrollbar, NSelect, NSpace, NSpin, NSwitch, NText, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import BlockPageRenderer from '@/features/user-page/block/BlockPageRenderer.vue'
import type { BlockNode, BlockPageProject, BlockType } from '@/features/user-page/block/schema'
import { validateBlockPageProject } from '@/features/user-page/block/schema'
import { parseEmbedUrl } from '@/features/user-page/block/embed'
import { fetchMyUserPagesSettings, saveMyUserPagesSettings } from '@/features/user-page/api'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/features/user-page/types'

const message = useMessage()
const account = useAccount()

const isLoading = ref(true)
const isSaving = ref(false)
const error = ref<string | null>(null)

const settings = ref<UserPagesSettingsV1>({
  version: 1,
  home: { mode: 'legacy' },
  pages: {},
})

const currentKey = ref<string>('home')
const selectedBlockId = ref<string | null>(null)

const currentLabel = computed(() => (currentKey.value === 'home' ? '主页' : `/${currentKey.value}`))
const currentPage = ref<UserPageConfig>({ mode: 'legacy' })

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createDefaultProject(): BlockPageProject {
  return {
    version: 1,
    theme: {
      spacing: 'normal',
      radius: 12,
    },
    blocks: [
      { id: createId(), type: 'profile' },
      {
        id: createId(),
        type: 'buttons',
        props: {
          items: [],
        },
      },
      { id: createId(), type: 'footer' },
    ],
  }
}

function ensurePageConfig(key: string): UserPageConfig {
  if (key === 'home') {
    settings.value.home ??= { mode: 'legacy' }
    return settings.value.home
  }
  settings.value.pages ??= {}
  settings.value.pages[key] ??= { mode: 'block', block: createDefaultProject() }
  return settings.value.pages[key]
}

watch(
  () => currentKey.value,
  (key) => {
    currentPage.value = ensurePageConfig(key)
    selectedBlockId.value = null
  },
  { immediate: true },
)

watch(
  () => currentPage.value.mode,
  (mode) => {
    if (mode === 'block') {
      currentPage.value.block ??= createDefaultProject()
      currentPage.value.block.theme ??= {}
    }
    if (mode === 'contrib') {
      currentPage.value.contrib ??= { scope: 'global', pageId: '' }
      if (currentPage.value.contrib.scope === 'streamer') currentPage.value.contrib.streamerId = account.value.id
    }
  },
  { immediate: true },
)

watch(
  () => account.value.id,
  (id) => {
    if (currentPage.value.mode !== 'contrib') return
    if (currentPage.value.contrib?.scope === 'streamer') currentPage.value.contrib.streamerId = id
  },
)

watch(
  () => currentPage.value.contrib?.scope,
  (scope) => {
    if (currentPage.value.mode !== 'contrib') return
    if (!currentPage.value.contrib) return
    if (scope === 'streamer') currentPage.value.contrib.streamerId = account.value.id
    else delete currentPage.value.contrib.streamerId
  },
)

const currentProject = computed(() => (currentPage.value.mode === 'block' ? (currentPage.value.block ?? null) : null))
const currentTheme = computed(() => currentProject.value?.theme ?? null)
const currentContrib = computed(() => (currentPage.value.mode === 'contrib' ? (currentPage.value.contrib ?? null) : null))

const selectedBlock = computed<BlockNode | null>(() => {
  const p = currentProject.value
  if (!p || !selectedBlockId.value) return null
  return p.blocks.find(b => b.id === selectedBlockId.value) ?? null
})

function ensurePropsObject(block: BlockNode) {
  const v = block.props
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    block.props = {}
  }
  return block.props as Record<string, any>
}

function ensureItems(block: BlockNode) {
  const propsObj = ensurePropsObject(block)
  if (!Array.isArray(propsObj.items)) propsObj.items = []
  return propsObj.items as Array<{ label: string, url: string }>
}

function addBlock(type: BlockType) {
  if (!currentProject.value) return
  const block: BlockNode = { id: createId(), type, props: {} }
  if (type === 'heading') block.props = { text: '标题', level: 2 }
  if (type === 'text') block.props = { text: '' }
  if (type === 'links') block.props = { items: [] }
  if (type === 'buttons') block.props = { items: [] }
  if (type === 'image') block.props = { url: '', alt: '' }
  if (type === 'embed') block.props = { url: '', title: '' }
  if (type === 'divider') block.props = { text: '' }
  if (type === 'spacer') block.props = { size: 'md' }
  if (type === 'footer') block.props = { text: '' }
  currentProject.value.blocks.push(block)
  selectedBlockId.value = block.id
}

function moveBlock(blockId: string, dir: -1 | 1) {
  if (!currentProject.value) return
  const idx = currentProject.value.blocks.findIndex(b => b.id === blockId)
  if (idx < 0) return
  const next = idx + dir
  if (next < 0 || next >= currentProject.value.blocks.length) return
  const arr = currentProject.value.blocks
  ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
}

function removeBlock(blockId: string) {
  if (!currentProject.value) return
  currentProject.value.blocks = currentProject.value.blocks.filter(b => b.id !== blockId)
  if (selectedBlockId.value === blockId) selectedBlockId.value = null
}

function openPreview() {
  const name = account.value?.name
  if (!name) return
  const path = currentKey.value === 'home' ? `/@${name}` : `/@${name}/${currentKey.value}`
  window.open(path, '_blank', 'noopener,noreferrer')
}

function validateAll(settingsToValidate: UserPagesSettingsV1) {
  const problems: string[] = []

  const validatePage = (label: string, cfg: UserPageConfig | undefined) => {
    if (!cfg) return
    if (cfg.mode === 'block') {
      const v = validateBlockPageProject(cfg.block)
      if (!v.ok) problems.push(`${label}: ${v.errors.join('；')}`)
      return
    }
    if (cfg.mode === 'contrib') {
      const c = cfg.contrib
      if (!c) {
        problems.push(`${label}: 缺少 contrib 配置`)
        return
      }
      if (!c.pageId) problems.push(`${label}: contrib.pageId 不能为空`)
      if (c.scope === 'streamer' && !c.streamerId) problems.push(`${label}: contrib.streamerId 不能为空`)
    }
  }

  validatePage('home', settingsToValidate.home)
  Object.entries(settingsToValidate.pages ?? {}).forEach(([slug, cfg]) => validatePage(`pages.${slug}`, cfg))

  if (problems.length) throw new Error(problems.join('\n'))
}

async function save() {
  isSaving.value = true
  try {
    validateAll(settings.value)
    await saveMyUserPagesSettings(settings.value, true)
    message.success('已保存并发布（配置对外可读）')
  } catch (e) {
    message.error((e as Error).message || String(e))
  } finally {
    isSaving.value = false
  }
}

function slugOk(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)
}

const addPageModal = ref(false)
const newSlug = ref('')
function createPage() {
  const slug = newSlug.value.trim()
  if (!slugOk(slug)) {
    message.error('slug 仅支持小写字母/数字/短横线，且长度 1~40（不能以 - 开头/结尾）')
    return
  }
  settings.value.pages ??= {}
  if (settings.value.pages[slug]) {
    message.error('该 slug 已存在')
    return
  }
  settings.value.pages[slug] = { mode: 'block', block: createDefaultProject() }
  currentKey.value = slug
  selectedBlockId.value = null
  newSlug.value = ''
  addPageModal.value = false
}

function removePage(slug: string) {
  if (!settings.value.pages?.[slug]) return
  delete settings.value.pages[slug]
  if (currentKey.value === slug) currentKey.value = 'home'
  selectedBlockId.value = null
}

function onEmbedUrlBlur(block: BlockNode) {
  try {
    const propsObj = ensurePropsObject(block)
    if (!propsObj.url) return
    parseEmbedUrl(String(propsObj.url), typeof propsObj.title === 'string' ? propsObj.title : undefined)
  } catch (e) {
    message.error((e as Error).message || String(e))
  }
}

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    const s = await fetchMyUserPagesSettings()
    if (s) settings.value = s
    currentPage.value = ensurePageConfig(currentKey.value)
  } catch (e) {
    error.value = (e as Error).message || String(e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <NSpin :show="isLoading">
    <NAlert
      v-if="error"
      type="error"
      :show-icon="true"
      style="margin-bottom: 12px"
    >
      {{ error }}
    </NAlert>

    <NFlex
      :wrap="false"
      style="gap: 12px"
    >
      <NCard
        title="页面"
        style="width: 240px; flex: 0 0 240px"
      >
        <NSpace vertical>
          <NButton
            type="primary"
            @click="currentKey = 'home'; selectedBlockId = null"
          >
            主页（/@{{ account.name || 'name' }}）
          </NButton>
          <NDivider style="margin: 0" />
          <NButton
            type="info"
            @click="addPageModal = true"
          >
            新建子页面
          </NButton>
          <NScrollbar style="max-height: 55vh">
            <NSpace vertical>
              <div
                v-for="slug in Object.keys(settings.pages ?? {})"
                :key="slug"
                style="display: flex; gap: 8px; align-items: center"
              >
                <NButton
                  :type="currentKey === slug ? 'primary' : 'default'"
                  style="flex: 1"
                  @click="currentKey = slug; selectedBlockId = null"
                >
                  /{{ slug }}
                </NButton>
                <NPopconfirm
                  @positive-click="removePage(slug)"
                >
                  <template #trigger>
                    <NButton
                      quaternary
                      type="error"
                    >
                      删除
                    </NButton>
                  </template>
                  确定删除 /{{ slug }} ?
                </NPopconfirm>
              </div>
            </NSpace>
          </NScrollbar>
        </NSpace>
      </NCard>

      <NCard
        :title="`预览 - ${currentLabel}`"
        style="flex: 1; min-width: 480px"
      >
        <NAlert
          type="info"
          :show-icon="true"
          style="margin-bottom: 12px"
        >
          目前配置通过 `user-config` 公开读取（`user-pages`）。保存后立即影响线上展示。
        </NAlert>
        <BlockPageRenderer
          v-if="currentPage.mode === 'block' && currentProject"
          :project="currentProject"
          :user-info="account"
          :bili-info="undefined"
        />
        <NAlert
          v-else
          type="warning"
          :show-icon="true"
        >
          当前页 mode={{ currentPage.mode }}（非 block），此处不展示 Block 预览。
        </NAlert>
      </NCard>

      <NCard
        title="编辑"
        style="width: 360px; flex: 0 0 360px"
      >
        <NSpace
          vertical
          size="large"
        >
          <div>
            <NText strong>
              页面模式
            </NText>
            <NRadioGroup v-model:value="currentPage.mode">
              <NRadioButton value="legacy">
                legacy
              </NRadioButton>
              <NRadioButton value="block">
                block
              </NRadioButton>
              <NRadioButton value="contrib">
                contrib
              </NRadioButton>
            </NRadioGroup>
          </div>

          <template v-if="currentPage.mode === 'contrib'">
            <NForm label-placement="top">
              <NFormItem label="scope">
                <NSelect
                  v-model:value="currentContrib!.scope"
                  :options="[{ label: 'global', value: 'global' }, { label: 'streamer', value: 'streamer' }]"
                />
              </NFormItem>
              <NFormItem label="pageId">
                <NInput v-model:value="currentContrib!.pageId" />
              </NFormItem>
              <NFormItem
                v-if="currentContrib!.scope === 'streamer'"
                label="streamerId（自动）"
              >
                <NInputNumber
                  :value="account.id"
                  :disabled="true"
                  style="width: 100%"
                />
              </NFormItem>
            </NForm>
          </template>

          <template v-if="currentPage.mode === 'block' && currentProject">
            <div>
              <NText strong>
                主题
              </NText>
              <NForm label-placement="top">
                <NFormItem label="primaryColor">
                  <NColorPicker v-model:value="currentTheme!.primaryColor" />
                </NFormItem>
                <NFormItem label="backgroundColor">
                  <NColorPicker v-model:value="currentTheme!.backgroundColor" />
                </NFormItem>
                <NFormItem label="textColor">
                  <NColorPicker v-model:value="currentTheme!.textColor" />
                </NFormItem>
                <NFormItem label="radius">
                  <NInputNumber
                    v-model:value="currentTheme!.radius"
                    :min="0"
                    :max="32"
                    style="width: 100%"
                  />
                </NFormItem>
                <NFormItem label="spacing">
                  <NSelect
                    v-model:value="currentTheme!.spacing"
                    :options="[{ label: 'compact', value: 'compact' }, { label: 'normal', value: 'normal' }, { label: 'relaxed', value: 'relaxed' }]"
                  />
                </NFormItem>
              </NForm>
            </div>

            <div>
              <NText strong>
                区块
              </NText>
              <NSpace wrap>
                <NButton size="small" @click="addBlock('profile')">
                  profile
                </NButton>
                <NButton size="small" @click="addBlock('heading')">
                  heading
                </NButton>
                <NButton size="small" @click="addBlock('text')">
                  text
                </NButton>
                <NButton size="small" @click="addBlock('buttons')">
                  buttons
                </NButton>
                <NButton size="small" @click="addBlock('links')">
                  links
                </NButton>
                <NButton size="small" @click="addBlock('image')">
                  image
                </NButton>
                <NButton size="small" @click="addBlock('embed')">
                  embed
                </NButton>
                <NButton size="small" @click="addBlock('divider')">
                  divider
                </NButton>
                <NButton size="small" @click="addBlock('spacer')">
                  spacer
                </NButton>
                <NButton size="small" @click="addBlock('footer')">
                  footer
                </NButton>
              </NSpace>

              <NDivider style="margin: 12px 0" />

              <NScrollbar style="max-height: 28vh">
                <NSpace vertical>
                  <div
                    v-for="b in currentProject.blocks"
                    :key="b.id"
                    style="display:flex; align-items: center; gap: 8px"
                  >
                    <NButton
                      :type="selectedBlockId === b.id ? 'primary' : 'default'"
                      style="flex: 1"
                      @click="selectedBlockId = b.id"
                    >
                      {{ b.type }}
                    </NButton>
                    <NSwitch v-model:value="b.hidden" size="small" />
                    <NButton size="tiny" @click="moveBlock(b.id, -1)">
                      ↑
                    </NButton>
                    <NButton size="tiny" @click="moveBlock(b.id, 1)">
                      ↓
                    </NButton>
                    <NButton
                      size="tiny"
                      type="error"
                      @click="removeBlock(b.id)"
                    >
                      ×
                    </NButton>
                  </div>
                </NSpace>
              </NScrollbar>
            </div>

            <div v-if="selectedBlock">
              <NDivider style="margin: 12px 0" />
              <NText strong>
                属性 - {{ selectedBlock.type }}
              </NText>

              <template v-if="selectedBlock.type === 'profile'">
                <NForm label-placement="top">
                  <NFormItem label="avatarUrl（可选，https）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).avatarUrl" />
                  </NFormItem>
                  <NFormItem label="displayName（可选）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).displayName" />
                  </NFormItem>
                  <NFormItem label="bio（可选）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).bio" type="textarea" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'heading'">
                <NForm label-placement="top">
                  <NFormItem label="text">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).text" />
                  </NFormItem>
                  <NFormItem label="level（1/2/3）">
                    <NInputNumber v-model:value="ensurePropsObject(selectedBlock).level" :min="1" :max="3" style="width: 100%" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'text'">
                <NForm label-placement="top">
                  <NFormItem label="text">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).text" type="textarea" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'links' || selectedBlock.type === 'buttons'">
                <NForm label-placement="top">
                  <NFormItem label="items">
                    <NSpace vertical style="width: 100%">
                      <div
                        v-for="(it, idx) in ensureItems(selectedBlock)"
                        :key="idx"
                        style="display:flex; gap: 8px"
                      >
                        <NInput v-model:value="it.label" placeholder="label" />
                        <NInput v-model:value="it.url" placeholder="https://..." />
                        <NButton type="error" @click="ensureItems(selectedBlock).splice(idx, 1)">
                          删除
                        </NButton>
                      </div>
                      <NButton
                        type="info"
                        @click="ensureItems(selectedBlock).push({ label: '', url: 'https://' })"
                      >
                        添加
                      </NButton>
                    </NSpace>
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'image'">
                <NForm label-placement="top">
                  <NFormItem label="url（https）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).url" placeholder="https://..." />
                  </NFormItem>
                  <NFormItem label="alt">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).alt" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'embed'">
                <NForm label-placement="top">
                  <NFormItem label="url（https，白名单：bilibili/youtube）">
                    <NInput
                      v-model:value="ensurePropsObject(selectedBlock).url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      @blur="onEmbedUrlBlur(selectedBlock)"
                    />
                  </NFormItem>
                  <NFormItem label="title（可选）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).title" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'divider'">
                <NForm label-placement="top">
                  <NFormItem label="text（可选）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).text" />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'spacer'">
                <NForm label-placement="top">
                  <NFormItem label="size">
                    <NSelect
                      v-model:value="ensurePropsObject(selectedBlock).size"
                      :options="[{ label: 'sm', value: 'sm' }, { label: 'md', value: 'md' }, { label: 'lg', value: 'lg' }]"
                    />
                  </NFormItem>
                </NForm>
              </template>

              <template v-else-if="selectedBlock.type === 'footer'">
                <NForm label-placement="top">
                  <NFormItem label="text（可选）">
                    <NInput v-model:value="ensurePropsObject(selectedBlock).text" />
                  </NFormItem>
                </NForm>
              </template>
            </div>
          </template>

          <NSpace justify="end">
            <NButton
              secondary
              @click="openPreview"
            >
              打开预览
            </NButton>
            <NButton
              type="primary"
              :loading="isSaving"
              @click="save"
            >
              保存
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>
    </NFlex>

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
          创建后可访问：/@{{ account.name || 'name' }}/{{ newSlug || 'slug' }}
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
  </NSpin>
</template>
