<script setup lang="ts">
import {
  CloudUploadOutline,
  CodeWorkingOutline,
  DesktopOutline,
  FolderOpenOutline,
  MoonOutline,
  PhonePortraitOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import { watchDebounced } from '@vueuse/core'
import { ClipboardPaste, FileUp, Trash2 } from 'lucide-vue-next'
import { computed, inject, ref, watch } from 'vue'

import type { APIFileModel } from '@/api/generated/model'
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
import { useFilePicker } from '@/composables/useFilePicker'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode, useDialog } from '@/shared/utils'

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

const dialog = useDialog()
const draft = ref<CustomHtmlProps>(deepCloneJson(normalizeCustomHtmlProps(props.block.props)))
const initialSnapshot = ref('')
const activeLanguage = ref<'html' | 'css'>('html')
const resourcesVisible = ref(true)
const resourceSearch = ref('')
const previewDevice = ref<'desktop' | 'mobile'>('desktop')
const previewDark = ref(isDarkMode.value)
const uploading = ref(false)
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
  '--foreground': previewTokens.value.foreground,
  '--muted-foreground': previewTokens.value.mutedForeground,
  '--background': previewTokens.value.canvas,
  '--card': previewTokens.value.surface,
  '--muted': previewTokens.value.inset,
  '--popover': previewTokens.value.elevated,
  '--border': previewTokens.value.borderColor,
  '--primary': previewTokens.value.brand,
  '--brand': previewTokens.value.brand,
  '--radius': previewTokens.value.radiusSurface,
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
  dialog.warning({
    title: '放弃未应用修改',
    content: '代码工作区中的修改尚未应用到区块。',
    positiveText: '放弃修改',
    negativeText: '继续编辑',
    onPositiveClick: () => {
      show.value = false
    },
  })
}

function updateShow(value: boolean) {
  if (!value) closeEditor()
}

const { open: openImageUpload } = useFilePicker({
  accept: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  maxSize: 10 * 1024 * 1024,
  onError: editor.message.error,
  onSelect: handleUpload,
})

async function handleUpload(files: File[]) {
  const fileError = validateUserPageImageFiles(files, false)
  if (fileError) {
    editor.message.error(fileError)
    return
  }
  uploading.value = true
  try {
    const uploaded = await uploadFiles(files[0], FileStore.Configs)
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
    if (!visible) {
      manualPasteOpen.value = false
      manualPasteText.value = ''
      return
    }
    resetDraft()
    void resources.loadResources()
  },
  { immediate: true },
)
watchDebounced([() => draft.value.html, () => draft.value.css, imageResources], syncReferencedResources, {
  debounce: 180,
  deep: true,
})
const codeFileInputRef = ref<HTMLInputElement | null>(null)
const manualPasteOpen = ref(false)
const manualPasteText = ref('')

function applyCodeText(text: string) {
  const current = activeLanguage.value === 'html' ? draft.value.html : draft.value.css
  if (!current.trim()) {
    codeEditor.value?.setContent(text)
  } else {
    codeEditor.value?.insertText(text)
  }
}

async function handlePasteFromClipboard() {
  try {
    if (!navigator.clipboard?.readText) {
      openManualPasteDialog()
      return
    }
    const text = await navigator.clipboard.readText()
    if (!text?.trim()) {
      editor.message.warning('剪贴板中没有文本内容')
      return
    }
    if (text.length > 1024 * 1024) {
      editor.message.warning('剪贴板文本超过 1MB 限制')
      return
    }
    applyCodeText(text)
    editor.message.success(`已粘贴剪贴板文本 (${text.length} 字符)`)
  } catch {
    openManualPasteDialog()
  }
}

function triggerCodeFileInput() {
  codeFileInputRef.value?.click()
}

async function onCodeFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 1024 * 1024) {
      editor.message.warning('文件大小超过 1MB 限制')
      return
    }
    const content = await file.text()
    if (!content.trim()) {
      editor.message.warning('所选文件内容为空')
      return
    }
    const lowerName = file.name.toLowerCase()
    let targetLang: 'html' | 'css' = activeLanguage.value
    if (lowerName.endsWith('.css')) {
      targetLang = 'css'
    } else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
      targetLang = 'html'
    }
    activeLanguage.value = targetLang
    codeEditor.value?.setContent(content, targetLang)
    editor.message.success(`已导入 ${file.name} (${content.length} 字符)`)
  } catch {
    editor.message.error('读取文件失败')
  } finally {
    input.value = ''
  }
}

function handleClearCode() {
  const lang = activeLanguage.value.toUpperCase()
  const current = activeLanguage.value === 'html' ? draft.value.html : draft.value.css
  if (!current.trim()) {
    editor.message.info(`当前 ${lang} 代码已为空`)
    return
  }
  dialog.warning({
    title: `清空 ${lang} 代码`,
    content: `确定要清空当前的 ${lang} 代码吗？清空后仍可在编辑器中按 Ctrl+Z 撤销。`,
    positiveText: '确定清空',
    negativeText: '取消',
    onPositiveClick: () => {
      codeEditor.value?.clearContent()
      editor.message.success(`已清空当前 ${lang} 代码 (可按 Ctrl+Z 撤销)`)
    },
  })
}

function openManualPasteDialog() {
  manualPasteText.value = ''
  manualPasteOpen.value = true
}

function confirmManualPaste() {
  const text = manualPasteText.value
  if (!text.trim()) return
  if (text.length > 1024 * 1024) {
    editor.message.warning('粘贴文本超过 1MB 限制')
    return
  }
  applyCodeText(text)
  manualPasteOpen.value = false
  manualPasteText.value = ''
  editor.message.success(`已载入文本 (${text.length} 字符)`)
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="updateShow"
  >
    <DialogContent class="max-w-[min(1600px,96vw)] h-[min(920px,94dvh)] p-0 flex flex-col gap-0 overflow-hidden">
      <DialogHeader class="p-3.5 border-b flex flex-row items-center justify-between shrink-0">
        <DialogTitle class="text-base font-semibold"> 自定义 HTML/CSS </DialogTitle>
        <div class="flex items-center gap-2 pr-6">
          <Tag
            v-if="codeIssues.length"
            variant="destructive"
            class="text-xs"
          >
            {{ codeIssues.length }} 个问题
          </Tag>
          <Button
            variant="outline"
            @click="closeEditor"
          >
            取消
          </Button>
          <Button @click="applyChanges"> 应用 </Button>
        </div>
      </DialogHeader>

      <div
        class="workspace flex-1 min-h-0"
        :class="{ 'resources-hidden': !resourcesVisible }"
      >
        <aside
          v-if="resourcesVisible"
          class="resources-pane flex flex-col border-r bg-muted/20"
        >
          <div class="p-3 border-b flex flex-col gap-2 shrink-0">
            <div class="flex justify-between items-center">
              <span class="text-xs font-semibold text-foreground">图片资源</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      :disabled="uploading"
                        aria-label="上传图片"
                        @click="openImageUpload()"
                      >
                      <CloudUploadOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 上传图片 </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
              <Input
                v-model="resourceSearch"
                size="xs"
                placeholder="搜索文件"
              />
            </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-2">
            <div
              v-if="filteredResources.length"
              class="resource-list space-y-1"
            >
              <button
                v-for="file in filteredResources"
                :key="file.id"
                type="button"
                class="resource-row w-full flex items-center gap-2 p-1.5 rounded text-left hover:bg-muted text-xs transition-colors"
                @click="attachResource(file)"
              >
                <img
                  :src="file.path"
                  alt=""
                  class="size-8 rounded object-cover shrink-0"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
                <span class="resource-copy flex-1 min-w-0">
                  <strong class="block truncate text-foreground">{{ file.name || `资源 #${file.id}` }}</strong>
                  <small class="text-muted-foreground"
                    >#{{ file.id }}<template v-if="attachedIds.has(file.id)"> · 已绑定</template></small
                  >
                </span>
              </button>
            </div>
            <div
              v-else-if="!resources.isLoading.value"
              class="py-8 text-center text-xs text-muted-foreground"
            >
              没有可用图片
            </div>
          </div>
        </aside>

        <section class="code-pane flex flex-col min-h-0 border-r">
          <div class="pane-toolbar flex justify-between items-center px-3 py-2 border-b bg-card shrink-0">
            <Tabs
              :model-value="activeLanguage"
              class="w-auto"
              @update:model-value="(val) => (activeLanguage = val as any)"
            >
              <TabsList size="xs">
                <TabsTrigger value="html"> HTML </TabsTrigger>
                <TabsTrigger value="css"> CSS </TabsTrigger>
              </TabsList>
            </Tabs>
            <div class="flex items-center gap-1">
              <input
                ref="codeFileInputRef"
                type="file"
                accept=".css,.html,.htm,.txt"
                class="hidden"
                @change="onCodeFileSelected"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      aria-label="从剪贴板粘贴"
                      @click="handlePasteFromClipboard"
                    >
                      <ClipboardPaste class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 从剪贴板粘贴 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      aria-label="导入代码文件"
                      @click="triggerCodeFileInput"
                    >
                      <FileUp class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 导入代码文件 (.css / .html) </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      aria-label="清空当前代码"
                      @click="handleClearCode"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 清空当前代码 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      aria-label="格式化代码"
                      @click="codeEditor?.formatDocument()"
                    >
                      <CodeWorkingOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 格式化代码 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      aria-label="切换资源栏"
                      @click="resourcesVisible = !resourcesVisible"
                    >
                      <FolderOpenOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> {{ resourcesVisible ? '收起资源栏' : '展开资源栏' }} </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div class="px-3 py-1 bg-muted/30 border-b text-[11px] text-muted-foreground shrink-0 flex items-center justify-between">
            <span>HTML {{ htmlBytes }}/{{ CUSTOM_HTML_MAX_BYTES }} bytes · CSS {{ cssBytes }}/{{ CUSTOM_CSS_MAX_BYTES }} bytes</span>
            <span class="opacity-80">支持快捷键直接粘贴</span>
          </div>
          <div class="flex-1 min-h-0">
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
          </div>
        </section>

        <section class="preview-pane flex flex-col min-h-0 bg-muted/10">
          <div
            class="pane-toolbar preview-toolbar flex justify-between items-center px-3 py-2 border-b bg-card shrink-0"
          >
            <span class="text-xs font-semibold text-foreground"> 实时预览 </span>
            <div class="flex items-center gap-1.5">
              <div class="inline-flex rounded-md border p-0.5 bg-muted">
                <Button
                  size="icon"
                  :variant="previewDevice === 'desktop' ? 'default' : 'ghost'"
                  class="size-6"
                  aria-label="桌面预览"
                  @click="previewDevice = 'desktop'"
                >
                  <DesktopOutline class="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  :variant="previewDevice === 'mobile' ? 'default' : 'ghost'"
                  class="size-6"
                  aria-label="移动预览"
                  @click="previewDevice = 'mobile'"
                >
                  <PhonePortraitOutline class="size-3.5" />
                </Button>
              </div>
              <Button
                size="icon"
                variant="ghost"
                class="size-7"
                :aria-label="previewDark ? '切换亮色预览' : '切换暗色预览'"
                @click="previewDark = !previewDark"
              >
                <SunnyOutline
                  v-if="previewDark"
                  class="size-4"
                />
                <MoonOutline
                  v-else
                  class="size-4"
                />
              </Button>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto">
            <div
              class="preview-stage min-h-full p-4 flex justify-center"
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
        </section>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="manualPasteOpen">
    <DialogContent class="max-w-md p-4 flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">粘贴代码</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          浏览器剪贴板自动读取受限，请在下方输入框粘贴代码（Ctrl/⌘+V）后导入：
        </DialogDescription>
      </DialogHeader>
      <Textarea
        v-model="manualPasteText"
        class="h-36 font-mono text-xs resize-none"
        placeholder="在此粘贴代码..."
        aria-label="粘贴代码内容"
        autofocus
        @keydown.ctrl.enter.prevent="confirmManualPaste"
        @keydown.meta.enter.prevent="confirmManualPaste"
      />
      <DialogFooter class="flex justify-end gap-2">
        <Button
          variant="outline"
          @click="manualPasteOpen = false"
        >
          取消
        </Button>
        <Button
          :disabled="!manualPasteText.trim()"
          @click="confirmManualPaste"
        >
          确定载入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 240px minmax(420px, 1.35fr) minmax(340px, 1fr);
  height: 100%;
}

.workspace.resources-hidden {
  grid-template-columns: minmax(480px, 1.45fr) minmax(340px, 1fr);
}

.code-pane :deep(.code-editor) {
  height: 100%;
  min-height: 0;
}
</style>
