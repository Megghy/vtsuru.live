<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import type { APIFileModel } from '@/api/api-models'
import { UserFileLocation, UserFileTypes } from '@/api/api-models'
import CustomHtmlBlock from '@/apps/user-page/block/blocks/CustomHtmlBlock.vue'
import {
  CUSTOM_CSS_MAX_BYTES,
  CUSTOM_HTML_MAX_BYTES,
  normalizeCustomHtmlProps,
  utf8ByteLength,
} from '@/apps/user-page/block/customHtmlContract'
import type { CustomHtmlProps } from '@/apps/user-page/block/customHtmlContract'
import {
  collectCustomHtmlAssetKeys,
  inspectCustomCss,
  inspectCustomHtml,
} from '@/apps/user-page/block/customHtmlRuntime'
import type { CustomHtmlTheme } from '@/apps/user-page/block/customHtmlRuntime'
import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import { countImagesInBlocks, MAX_PAGE_IMAGES } from '@/apps/user-page/block/schema'
import { resolveUserPageReadableAccent } from '@/apps/user-page/theme'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { uploadFiles } from '@/shared/services/fileUpload'
import { isDarkMode } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import { deepCloneJson } from '../editorHelpers'
import { useBuilderResources } from '../useBuilderResources'
import { findBlockById } from '../userPageBlockTree'
import { isSupportedUserPageImagePath, validateUserPageImageFiles } from '../userPageImageUpload'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'

const props = defineProps<{ block: BlockNode }>()
const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const draft = ref<CustomHtmlProps>(deepCloneJson(normalizeCustomHtmlProps(props.block.props)))
const initialSnapshot = ref('')
const activeLanguage = ref<'html' | 'css'>('html')
const resourcesVisible = ref(true)
const resourceSearch = ref('')
const previewDevice = ref<'desktop' | 'mobile'>('desktop')
const previewDark = ref(isDarkMode.value)
const uploading = ref(false)
const uploadInput = ref<HTMLInputElement | null>(null)
const codeEditor = ref<InstanceType<typeof CustomHtmlCodeEditor> | null>(null)
const resources = useBuilderResources({
  fileRefs: editor.fileRefs,
  notifyError: editor.message.error,
  notifySuccess: editor.message.success,
})

const imageResources = computed(() =>
  resources.resources.value.filter((resource) => !resource.missing && isSupportedUserPageImagePath(resource.path)),
)
const filteredResources = computed(() => {
  const query = resourceSearch.value.trim().toLowerCase()
  if (!query) return imageResources.value
  return imageResources.value.filter((file) => `${file.id} ${file.name} ${file.path}`.toLowerCase().includes(query))
})
const attachedIds = computed(() => new Set(draft.value.assets.map((asset) => asset.file.id)))
const htmlBytes = computed(() => utf8ByteLength(draft.value.html))
const cssBytes = computed(() => utf8ByteLength(draft.value.css))
const codeIssues = computed(() => {
  const issues = [
    ...inspectCustomHtml(draft.value.html, draft.value.assets),
    ...inspectCustomCss(draft.value.css, draft.value.assets).issues,
  ]
  if (htmlBytes.value > CUSTOM_HTML_MAX_BYTES)
    issues.push({ field: 'html', message: 'HTML 不能超过 32 KiB', line: 1, column: 1 })
  if (cssBytes.value > CUSTOM_CSS_MAX_BYTES)
    issues.push({ field: 'css', message: 'CSS 不能超过 24 KiB', line: 1, column: 1 })
  return issues
})
const isDirty = computed(() => JSON.stringify(draft.value) !== initialSnapshot.value)
const monacoTheme = computed(() => (previewDark.value ? ('vs-dark' as const) : ('vs' as const)))
const previewTokens = computed(() => buildSiteTokens(previewDark.value))
const previewTheme = computed<CustomHtmlTheme>(() => ({
  fg: previewTokens.value.foreground,
  fgMuted: previewTokens.value.mutedForeground,
  bg: previewTokens.value.canvas,
  bgElevated: previewTokens.value.elevated,
  border: previewTokens.value.borderColor,
  primary: previewTokens.value.brand,
  primaryReadable: resolveUserPageReadableAccent(previewTokens.value.brand, undefined, previewDark.value),
  radius: previewTokens.value.radiusSurface,
  colorScheme: previewDark.value ? 'dark' : 'light',
}))
const previewStyle = computed(() => ({
  width: previewDevice.value === 'mobile' ? '390px' : '100%',
  maxWidth: '100%',
  '--vtsuru-fg': previewTokens.value.foreground,
  '--vtsuru-fg-muted': previewTokens.value.mutedForeground,
  '--vtsuru-bg': previewTokens.value.canvas,
  '--vtsuru-bg-surface': previewTokens.value.surface,
  '--vtsuru-bg-muted': previewTokens.value.surfaceHover,
  '--vtsuru-bg-inset': previewTokens.value.inset,
  '--vtsuru-bg-elevated': previewTokens.value.elevated,
  '--vtsuru-border': previewTokens.value.borderColor,
  '--vtsuru-brand': previewTokens.value.brand,
  '--vtsuru-radius': previewTokens.value.radiusSurface,
  '--vtsuru-page-primary': previewTokens.value.brand,
  '--vtsuru-page-radius': previewTokens.value.radiusSurface,
  '--vtsuru-block-fg': previewTokens.value.foreground,
  '--vtsuru-block-fg-muted': previewTokens.value.mutedForeground,
  '--vtsuru-block-bg': previewTokens.value.surface,
  '--vtsuru-block-bg-elevated': previewTokens.value.elevated,
  '--vtsuru-block-border': previewTokens.value.borderColor,
  colorScheme: previewDark.value ? 'dark' : 'light',
}))

function resetDraft() {
  draft.value = deepCloneJson(normalizeCustomHtmlProps(props.block.props))
  initialSnapshot.value = JSON.stringify(draft.value)
}

function projectWithDraft(): BlockPageProject | null {
  const project = editor.currentProject.value
  if (!project) return null
  const clone = deepCloneJson(project)
  const block = findBlockById(clone, props.block.id)
  if (!block) return null
  block.props = deepCloneJson(draft.value)
  return clone
}

function attachResource(file: APIFileModel, insert = true) {
  if (!attachedIds.value.has(file.id)) {
    draft.value.assets.push({ key: `file-${file.id}`, file: { ...file } })
    const project = projectWithDraft()
    if (project && countImagesInBlocks(project.blocks) > MAX_PAGE_IMAGES) {
      draft.value.assets.pop()
      editor.message.error(`图片数量将超过每页上限 ${MAX_PAGE_IMAGES}`)
      return
    }
  }
  if (!insert) return
  const key = draft.value.assets.find((asset) => asset.file.id === file.id)?.key ?? `file-${file.id}`
  codeEditor.value?.insertText(
    activeLanguage.value === 'html' ? `\n<img data-vtsuru-asset="${key}" alt="">` : `var(--vtsuru-asset-${key})`,
  )
}

function syncReferencedResources() {
  const keys = collectCustomHtmlAssetKeys(draft.value.html, draft.value.css)
  const attachedKeys = new Set(draft.value.assets.map((asset) => asset.key))
  keys.forEach((key) => {
    if (attachedKeys.has(key)) return
    const match = key.match(/^file-(\d+)$/)
    const file = match ? imageResources.value.find((item) => item.id === Number(match[1])) : null
    if (file) attachResource(file, false)
  })
}

function applyChanges() {
  const usedKeys = collectCustomHtmlAssetKeys(draft.value.html, draft.value.css)
  draft.value.assets = draft.value.assets.filter((asset) => usedKeys.has(asset.key))
  editor.batchHistory(() => {
    props.block.props = deepCloneJson(draft.value)
  })
  initialSnapshot.value = JSON.stringify(draft.value)
  show.value = false
  editor.message.success('自定义代码已应用')
}

function closeEditor() {
  if (!isDirty.value) {
    show.value = false
    return
  }
  if (window.confirm('代码工作区中的修改尚未应用到区块。确定放弃修改吗？')) show.value = false
}

function updateShow(value: boolean) {
  if (!value) closeEditor()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? [...input.files] : []
  input.value = ''
  const fileError = validateUserPageImageFiles(files, false)
  if (fileError) {
    editor.message.error(fileError)
    return
  }
  uploading.value = true
  try {
    const uploaded = await uploadFiles(files[0], UserFileTypes.Image, UserFileLocation.Local)
    if (!uploaded.length) throw new Error('上传失败：无返回结果')
    resources.addResources(uploaded)
    attachResource(uploaded[0])
    editor.message.success('图片已上传并插入')
  } catch (error) {
    editor.message.error((error as Error).message || String(error))
  } finally {
    uploading.value = false
  }
}

watch(
  show,
  (visible) => {
    if (!visible) return
    resetDraft()
    void resources.loadResources()
  },
  { immediate: true },
)
watchDebounced([() => draft.value.html, () => draft.value.css, imageResources], syncReferencedResources, {
  debounce: 180,
  deep: true,
})
</script>

<template>
  <UModal
    :open="show"
    title="自定义 HTML/CSS"
    class="custom-code-modal"
    :style="{ width: 'min(1600px, 96vw)', height: 'min(920px, 94dvh)' }"
    :dismissible="false"
    @update:open="updateShow"
  >
    <template #actions>
      <div class="builder-row">
        <UBadge
          v-if="codeIssues.length"
          type="error"
          size="sm"
        >
          {{ codeIssues.length }} 个问题
        </UBadge>
        <UButton
          size="sm"
          variant="soft"
          @click="closeEditor"
        >
          取消
        </UButton>
        <UButton
          size="sm"
          color="primary"
          @click="applyChanges"
        >
          应用
        </UButton>
      </div>
    </template>

    <template #body
      ><div
        class="workspace"
        :class="{ 'resources-hidden': !resourcesVisible }"
      >
        <aside
          v-if="resourcesVisible"
          class="resources-pane"
        >
          <div class="builder-stack resources-toolbar">
            <div class="builder-row">
              <span class="builder-text"> 图片资源 </span>
              <UTooltip>
                <UButton
                  square
                  variant="soft"
                  size="sm"
                  :loading="uploading"
                  aria-label="上传图片"
                  @click="uploadInput?.click()"
                >
                  <template #icon>
                    <UIcon name="i-lucide-cloud-upload" />
                  </template>
                </UButton>
                <template #content> 上传图片 </template></UTooltip
              >
            </div>
            <UInput
              v-model="resourceSearch"
              size="sm"
              clearable
              placeholder="搜索文件"
            />
            <input
              ref="uploadInput"
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
              hidden
              @change="handleUpload"
            />
          </div>
          <div class="builder-scroll resource-scroll">
            <div
              v-if="filteredResources.length"
              class="resource-list"
            >
              <button
                v-for="file in filteredResources"
                :key="file.id"
                type="button"
                class="resource-row"
                @click="attachResource(file)"
              >
                <img
                  :src="file.path"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
                <span class="resource-copy">
                  <strong>{{ file.name || `资源 #${file.id}` }}</strong>
                  <small>#{{ file.id }}<template v-if="attachedIds.has(file.id)"> · 已绑定</template></small>
                </span>
              </button>
            </div>
            <UEmpty
              v-else-if="!resources.isLoading.value"
              size="small"
              description="没有可用图片"
            />
          </div>
        </aside>

        <section class="code-pane">
          <div class="pane-toolbar">
            <div class="builder-row">
              <UTabs
                v-model="activeLanguage"
                :items="[
                  { label: 'HTML', value: 'html' },
                  { label: 'CSS', value: 'css' },
                ]"
                size="sm"
                class="language-tabs"
              />
              <div class="builder-row">
                <UTooltip>
                  <UButton
                    square
                    variant="soft"
                    size="sm"
                    aria-label="切换资源栏"
                    @click="resourcesVisible = !resourcesVisible"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-folder-open" />
                    </template>
                  </UButton>

                  <template #content>{{ resourcesVisible ? '收起资源栏' : '展开资源栏' }}</template>
                </UTooltip>
                <UTooltip>
                  <UButton
                    square
                    variant="soft"
                    size="sm"
                    aria-label="格式化代码"
                    @click="codeEditor?.formatDocument()"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-code-2" />
                    </template>
                  </UButton>
                  <template #content> 格式化代码 </template></UTooltip
                >
              </div>
            </div>
            <span class="builder-text byte-count">
              HTML {{ htmlBytes }}/{{ CUSTOM_HTML_MAX_BYTES }} bytes · CSS {{ cssBytes }}/{{ CUSTOM_CSS_MAX_BYTES }}
              bytes
            </span>
          </div>
          <CustomHtmlCodeEditor
            ref="codeEditor"
            :html="draft.html"
            :css="draft.css"
            :active-language="activeLanguage"
            :theme="monacoTheme"
            :assets="draft.assets"
            :resources="imageResources"
            :issues="codeIssues"
            @update:html="draft.html = $event"
            @update:css="draft.css = $event"
          />
        </section>

        <section class="preview-pane">
          <div class="pane-toolbar preview-toolbar">
            <span class="builder-text"> 实时预览 </span>
            <div class="builder-row">
              <UButtonGroup size="small">
                <UTooltip>
                  <UButton
                    :color="previewDevice === 'desktop' ? 'primary' : 'default'"
                    variant="soft"
                    aria-label="桌面预览"
                    @click="previewDevice = 'desktop'"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-monitor" />
                    </template>
                  </UButton>
                  <template #content> 桌面预览 </template></UTooltip
                >
                <UTooltip>
                  <UButton
                    :color="previewDevice === 'mobile' ? 'primary' : 'default'"
                    variant="soft"
                    aria-label="移动预览"
                    @click="previewDevice = 'mobile'"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-smartphone" />
                    </template>
                  </UButton>
                  <template #content> 移动预览 </template></UTooltip
                >
              </UButtonGroup>
              <UTooltip>
                <UButton
                  square
                  variant="soft"
                  size="sm"
                  :aria-label="previewDark ? '切换亮色预览' : '切换暗色预览'"
                  @click="previewDark = !previewDark"
                >
                  <template #icon>
                    <UIcon :name="previewDark ? 'i-lucide-sun' : 'i-lucide-moon'" />
                  </template>
                </UButton>

                <template #content>{{ previewDark ? '亮色预览' : '暗色预览' }}</template>
              </UTooltip>
            </div>
          </div>
          <div class="builder-scroll preview-scroll">
            <div
              class="preview-stage"
              :class="{ dark: previewDark }"
            >
              <div
                class="preview-content"
                :style="previewStyle"
              >
                <CustomHtmlBlock
                  :block-props="draft"
                  :theme="previewTheme"
                />
              </div>
            </div>
          </div>
        </section></div
    ></template>
  </UModal>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 240px minmax(420px, 1.35fr) minmax(340px, 1fr);
  height: calc(min(920px, 94dvh) - 66px);
  min-height: 0;
}

.workspace.resources-hidden {
  grid-template-columns: minmax(420px, 1.35fr) minmax(340px, 1fr);
}

.resources-pane,
.code-pane,
.preview-pane {
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--vtsuru-border);
}

.resources-pane,
.code-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
}

.preview-pane {
  border-right: 0;
}
.resources-toolbar,
.pane-toolbar {
  flex: 0 0 auto;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vtsuru-border);
}
.byte-count {
  display: block;
  margin-top: 6px;
  font-size: 11px;
}
.resource-scroll,
.preview-scroll {
  flex: 1;
  min-height: 0;
}
.resource-list {
  padding: 6px;
}
.resource-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 7px;
  border: 0;
  border-radius: 6px;
  color: var(--vtsuru-fg);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.resource-row:hover {
  background: var(--vtsuru-bg-muted);
}
.resource-row:focus-visible {
  outline: 2px solid var(--vtsuru-brand);
  outline-offset: -2px;
}
.resource-row img {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
  object-fit: cover;
}
.resource-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.resource-copy strong,
.resource-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-copy strong {
  font-size: 12px;
  font-weight: 600;
}
.resource-copy small {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}
.preview-toolbar {
  display: flex;
  min-height: 53px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.preview-stage {
  min-height: 100%;
  padding: 24px;
  background: #f4f4f5;
}
.preview-stage.dark {
  background: #18181b;
}
.preview-content {
  margin: 0 auto;
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg);
  transition: width 160ms ease;
}

@media (max-width: 980px) {
  .workspace,
  .workspace.resources-hidden {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(380px, 1fr) minmax(300px, 0.8fr);
    overflow: auto;
  }
  .workspace.resources-hidden {
    grid-template-rows: minmax(380px, 1fr) minmax(300px, 0.8fr);
  }
  .resources-pane {
    max-height: 220px;
  }
  .resources-pane,
  .code-pane {
    border-right: 0;
    border-bottom: 1px solid var(--vtsuru-border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview-content {
    transition: none;
  }
}
</style>
