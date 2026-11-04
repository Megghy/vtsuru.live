<script setup lang="ts">
import {
  CloudUploadOutline,
  CodeWorkingOutline,
  CopyOutline,
  DesktopOutline,
  FolderOpenOutline,
  MoonOutline,
  PhonePortraitOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import { watchDebounced } from '@vueuse/core'
import { ClipboardPaste, FileUp, Trash2 } from 'lucide-vue-next'
import { computed, inject, ref, watch } from 'vue'

import { FileKind } from '@/api/generated/model'
import type { APIFileModel } from '@/api/generated/model'
import CustomHtmlBlock from '@/apps/user-page/block/blocks/CustomHtmlBlock.vue'
import { compileCustomVueSfc } from '@/apps/user-page/block/customHtmlCompile'
import {
  CUSTOM_HTML_MAX_ASSETS,
  CUSTOM_VUE_MAX_BYTES,
  utf8ByteLength,
} from '@/apps/user-page/block/customHtmlContract'
import type { CustomHtmlProps } from '@/apps/user-page/block/customHtmlContract'
import { collectCustomHtmlAssetKeys, inspectCustomSource } from '@/apps/user-page/block/customHtmlRuntime'
import type { CustomCodeIssue, CustomHtmlTheme } from '@/apps/user-page/block/customHtmlRuntime'
import { CUSTOM_CODE_TEMPLATES, applyCustomCodeTemplate } from '@/apps/user-page/block/customHtmlTemplates'
import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import { countImagesInBlocks, MAX_PAGE_IMAGES } from '@/apps/user-page/block/schema'
import { resolveUserPageReadableAccent } from '@/apps/user-page/theme'
import { useFilePicker } from '@/composables/useFilePicker'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'
import { isDarkMode, useDialog } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import {
  appliedCustomHtmlDraft,
  getCustomHtmlWorkspaceKey,
  restoreCustomHtmlWorkspace,
} from '../customHtmlWorkspaceDraft'
import type { CustomHtmlWorkspaceDraft } from '../customHtmlWorkspaceDraft'
import { deepCloneJson } from '../editorHelpers'
import { useBuilderResources } from '../useBuilderResources'
import { findBlockById } from '../userPageBlockTree'
import { validateUserPageImageFiles } from '../userPageImageUpload'
import CustomHtmlApiReference from './CustomHtmlApiReference.vue'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'

const props = defineProps<{ block?: BlockNode; page?: boolean }>()
const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()
const sourceConfig = computed(() => (props.page ? editor.currentPage.value.custom : props.block?.props))
const draft = ref<CustomHtmlProps>(deepCloneJson(appliedCustomHtmlDraft(sourceConfig.value)))
const initialSnapshot = ref('')
const resourcesVisible = ref(true)
const apiReferenceOpen = ref(false)
const resourceSearch = ref('')
const resourceSources = ref<string[]>([FileStore.Configs])
const previewDevice = ref<'desktop' | 'mobile'>('desktop')
const previewDark = ref(isDarkMode.value)
const livePreview = ref(true)
const LIVE_PREVIEW_MS = 400
const uploading = ref(false)
const codeEditor = ref<InstanceType<typeof CustomHtmlCodeEditor> | null>(null)
const hydratingWorkspace = ref(false)
const accountId = computed(() => Number(editor.account?.value?.id ?? 0))
const workspaceScope = computed(() => (props.page ? 'page' : `block:${props.block?.id ?? 'unknown'}`))
const workspaceKey = computed(() =>
  getCustomHtmlWorkspaceKey(accountId.value, editor.currentKey.value, workspaceScope.value),
)
const workspaceDraft = usePersistedStorage<CustomHtmlWorkspaceDraft | null>(workspaceKey, null, {
  writeDefaults: false,
})
const resources = useBuilderResources({
  fileRefs: editor.fileRefs,
  notifyError: editor.message.error,
  notifySuccess: editor.message.success,
  kind: FileKind.Image,
  stores: resourceSources,
})

const imageResources = computed(() => resources.resources.value.filter((resource) => !resource.missing))
const filteredResources = computed(() => {
  const query = resourceSearch.value.trim().toLowerCase()
  if (!query) return imageResources.value
  return imageResources.value.filter((file) => `${file.id} ${file.name} ${file.path}`.toLowerCase().includes(query))
})
const attachedIds = computed(() => new Set(draft.value.assets.map((asset) => asset.file.id)))
const sourceBytes = computed(() => utf8ByteLength(draft.value.source))
const previewProps = ref<CustomHtmlProps>(deepCloneJson(draft.value))
const compiledIssues = ref<CustomCodeIssue[]>([])
const previewStale = computed(() => draft.value.source !== previewProps.value.source)

function collectIssues(targetProps: CustomHtmlProps): CustomCodeIssue[] {
  const issues = [...inspectCustomSource(targetProps.source, targetProps.assets), ...compileCustomVueSfc(targetProps.source).issues]
  if (targetProps.assets.length > CUSTOM_HTML_MAX_ASSETS)
    issues.push({ field: 'assets', message: `资源不能超过 ${CUSTOM_HTML_MAX_ASSETS} 项`, line: 1, column: 1 })
  if (utf8ByteLength(targetProps.source) > CUSTOM_VUE_MAX_BYTES)
    issues.push({ field: 'source', message: `Vue SFC 不能超过 ${CUSTOM_VUE_MAX_BYTES / 1024} KiB`, line: 1, column: 1 })
  return issues
}

function refreshPreview() {
  previewProps.value = deepCloneJson(draft.value)
  compiledIssues.value = collectIssues(previewProps.value)
}
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

function resetDraft(stash: CustomHtmlWorkspaceDraft | null = workspaceDraft.value) {
  const applied = appliedCustomHtmlDraft(sourceConfig.value)
  initialSnapshot.value = JSON.stringify(applied)
  const restored = restoreCustomHtmlWorkspace(applied, stash)
  draft.value = restored.props
  if (restored.dropStash) workspaceDraft.value = null
  refreshPreview()
}

function flushWorkspaceDraft() {
  if (hydratingWorkspace.value) return
  if (!isDirty.value) {
    workspaceDraft.value = null
    return
  }
  workspaceDraft.value = {
    baseSnapshot: initialSnapshot.value,
    props: deepCloneJson(draft.value),
  }
}

function projectWithDraft(): BlockPageProject | null {
  const project = editor.currentProject.value
  if (!project || !props.block) return null
  const clone = deepCloneJson(project)
  const block = findBlockById(clone, props.block.id)
  if (!block) return null
  block.props = deepCloneJson(draft.value)
  return clone
}

function attachResource(file: APIFileModel, insert = true) {
  if (!attachedIds.value.has(file.id)) {
    if (draft.value.assets.length >= CUSTOM_HTML_MAX_ASSETS) {
      editor.message.error(`资源不能超过 ${CUSTOM_HTML_MAX_ASSETS} 项`)
      return
    }
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
  codeEditor.value?.insertText(`\n<img data-vtsuru-asset="${key}" alt="">`)
}

async function copyResourcePath(path?: string | null) {
  if (!path) return
  try {
    await navigator.clipboard.writeText(path)
    editor.message.success('资源链接已复制')
  } catch {
    editor.message.error('复制失败，请检查浏览器剪贴板权限')
  }
}

function syncReferencedResources() {
  const keys = collectCustomHtmlAssetKeys(draft.value.source)
  const attachedKeys = new Set(draft.value.assets.map((asset) => asset.key))
  keys.forEach((key) => {
    if (attachedKeys.has(key)) return
    const match = key.match(/^file-(\d+)$/)
    const file = match ? imageResources.value.find((item) => item.id === Number(match[1])) : null
    if (file) attachResource(file, false)
  })
}

function applyChanges() {
  compiledIssues.value = collectIssues(draft.value)
  if (compiledIssues.value.length) return
  editor.batchHistory(() => {
    if (props.page) editor.currentPage.value.custom = deepCloneJson(draft.value)
    else if (props.block) props.block.props = deepCloneJson(draft.value)
  })
  initialSnapshot.value = JSON.stringify(draft.value)
  workspaceDraft.value = null
  show.value = false
  editor.message.success('自定义代码已应用')
}

function insertTemplate(key: string) {
  const apply = () => {
    draft.value = applyCustomCodeTemplate(draft.value, key)
    codeEditor.value?.setContent(draft.value.source)
  }
  if (!isDirty.value) return apply()
  dialog.warning({
    title: '替换代码',
    content: '模板将替换当前 Vue SFC。',
    positiveText: '替换',
    negativeText: '取消',
    onPositiveClick: apply,
  })
}

function closeEditor() {
  flushWorkspaceDraft()
  show.value = false
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

const codeFileInputRef = ref<HTMLInputElement | null>(null)
const manualPasteOpen = ref(false)
const manualPasteText = ref('')

watch(resourceSources, () => {
  if (show.value) void resources.loadResources()
})
watch(
  show,
  (visible) => {
    if (!visible) {
      manualPasteOpen.value = false
      manualPasteText.value = ''
      return
    }
    hydratingWorkspace.value = true
    resetDraft(null)
    void resources.loadResources()
    void whenPersistedReady(workspaceDraft).then((stash) => {
      if (!show.value) {
        hydratingWorkspace.value = false
        return
      }
      resetDraft(stash)
      hydratingWorkspace.value = false
    })
  },
  { immediate: true },
)
watchDebounced([() => draft.value.source, imageResources], syncReferencedResources, {
  debounce: 180,
  deep: true,
})
watchDebounced(
  draft,
  () => {
    if (!show.value) return
    flushWorkspaceDraft()
  },
  { debounce: 300, deep: true },
)
watchDebounced(
  draft,
  () => {
    if (!show.value || !livePreview.value || hydratingWorkspace.value) return
    refreshPreview()
  },
  { debounce: LIVE_PREVIEW_MS, maxWait: 1200, deep: true },
)
watch(livePreview, (enabled) => {
  if (enabled && show.value && !hydratingWorkspace.value) refreshPreview()
})

function applyCodeText(text: string) {
  if (!draft.value.source.trim()) codeEditor.value?.setContent(text)
  else codeEditor.value?.insertText(text)
}

function insertApiSnippet(snippet: string) {
  codeEditor.value?.insertText(snippet.endsWith('\n') ? snippet : `${snippet}\n`)
  apiReferenceOpen.value = false
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
    codeEditor.value?.setContent(content)
    editor.message.success(`已导入 ${file.name} (${content.length} 字符)`)
  } catch {
    editor.message.error('读取文件失败')
  } finally {
    input.value = ''
  }
}

function handleClearCode() {
  if (!draft.value.source.trim()) {
    editor.message.info('当前代码已为空')
    return
  }
  dialog.warning({
    title: '清空代码',
    content: '确定要清空当前的 Vue SFC 吗？清空后仍可在编辑器中按 Ctrl+Z 撤销。',
    positiveText: '确定清空',
    negativeText: '取消',
    onPositiveClick: () => {
      codeEditor.value?.clearContent()
      editor.message.success('已清空当前代码 (可按 Ctrl+Z 撤销)')
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
        <DialogTitle class="text-base"> 自定义 Vue </DialogTitle>
        <DialogDescription class="sr-only">使用 Vue 单文件组件编写自定义页面。</DialogDescription>
        <div class="flex items-center gap-2 pr-6">
          <DropdownMenu>
            <DropdownMenuTrigger as-child><Button variant="outline">插入模板 / 片段</Button></DropdownMenuTrigger>
            <DropdownMenuContent
              ><DropdownMenuItem
                v-for="template in CUSTOM_CODE_TEMPLATES"
                :key="template.key"
                @select="insertTemplate(template.key)"
                >{{ template.label }}</DropdownMenuItem
              ></DropdownMenuContent
            >
          </DropdownMenu>
          <Button
            variant="ghost"
            @click="apiReferenceOpen = true"
            >API 速查</Button
          >
          <Tag
            v-if="compiledIssues.length"
            variant="destructive"
            class="text-xs"
          >
            {{ compiledIssues.length }} 个问题
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
          class="resources-pane flex min-h-0 flex-col overflow-hidden border-r bg-muted/20"
        >
          <div class="p-3 border-b flex flex-col gap-2 shrink-0">
            <div class="flex justify-between items-center">
              <span class="text-xs font-semibold text-foreground">图片资源</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" :disabled="uploading" aria-label="上传图片" @click="openImageUpload()">
                      <CloudUploadOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 上传图片 </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ToggleGroup
              v-model="resourceSources"
              type="multiple"
              size="xs"
              class="h-auto w-full flex-wrap justify-start"
            >
              <ToggleGroupItem :value="FileStore.Configs">编辑器</ToggleGroupItem>
              <ToggleGroupItem :value="FileStore.Library">自己上传</ToggleGroupItem>
              <ToggleGroupItem :value="FileStore.Questions">提问箱</ToggleGroupItem>
            </ToggleGroup>
            <Input
              v-model="resourceSearch"
              size="xs"
              placeholder="搜索文件"
            />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
            <div
              v-if="filteredResources.length"
              class="resource-list space-y-1"
            >
              <div
                v-for="file in filteredResources"
                :key="file.id"
                class="resource-row flex items-center gap-0.5 rounded-md hover:bg-muted/50"
              >
                <Button
                  variant="ghost"
                  class="resource-row-main min-w-0 flex-1 h-auto justify-start gap-2 p-1.5"
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
                  <span class="min-w-0 flex-1 text-left">
                    <strong class="block truncate text-foreground">{{ file.name || `资源 #${file.id}` }}</strong>
                    <small class="text-muted-foreground"
                      >#{{ file.id }}<template v-if="attachedIds.has(file.id)"> · 已绑定</template></small
                    >
                  </span>
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="xs"
                        variant="ghost"
                        class="size-7 shrink-0"
                        :disabled="!file.path"
                        aria-label="复制资源链接"
                        @click.stop="copyResourcePath(file.path)"
                      >
                        <CopyOutline class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>复制链接</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
            <span class="text-xs font-semibold text-foreground">App.vue</span>
            <div class="flex items-center gap-1">
              <input
                ref="codeFileInputRef"
                type="file"
                accept=".vue,.txt"
                class="hidden"
                @change="onCodeFileSelected"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" aria-label="从剪贴板粘贴" @click="handlePasteFromClipboard">
                      <ClipboardPaste class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 从剪贴板粘贴 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" aria-label="导入代码文件" @click="triggerCodeFileInput">
                      <FileUp class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 导入 .vue 文件 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" aria-label="清空当前代码" @click="handleClearCode">
                      <Trash2 class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 清空当前代码 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" aria-label="格式化代码" @click="codeEditor?.formatDocument()">
                      <CodeWorkingOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> 格式化代码 </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="size-7" aria-label="切换资源栏" @click="resourcesVisible = !resourcesVisible">
                      <FolderOpenOutline class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> {{ resourcesVisible ? '收起资源栏' : '展开资源栏' }} </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div
            class="px-3 py-1 bg-muted/30 border-b text-[11px] text-muted-foreground shrink-0 flex items-center justify-between"
          >
            <span>Vue SFC {{ sourceBytes }}/{{ CUSTOM_VUE_MAX_BYTES }} bytes</span>
            <span class="opacity-80">支持快捷键直接粘贴</span>
          </div>
          <div class="flex-1 min-h-0">
            <CustomHtmlCodeEditor
              ref="codeEditor"
              :source="draft.source"
              :theme="monacoTheme"
              :assets="draft.assets"
              :resources="imageResources"
              :issues="compiledIssues"
              @update:source="draft.source = $event"
            />
          </div>
        </section>

        <section class="preview-pane flex flex-col min-h-0 bg-muted/10">
          <div
            class="pane-toolbar preview-toolbar flex justify-between items-center px-3 py-2 border-b bg-card shrink-0"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-semibold text-foreground">预览</span>
              <label class="inline-flex-center gap-1.5 text-xs text-muted-foreground">
                实时更新
                <Switch v-model="livePreview" />
              </label>
              <Button
                v-if="!livePreview"
                size="xs"
                :variant="previewStale ? 'default' : 'outline'"
                @click="refreshPreview"
              >
                更新预览
              </Button>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="inline-flex rounded-md border p-0.5 bg-muted">
                <Button size="xs" :variant="previewDevice === 'desktop' ? 'default' : 'ghost'" class="size-6" aria-label="桌面预览" @click="previewDevice = 'desktop'">
                  <DesktopOutline class="size-3.5" />
                </Button>
                <Button size="xs" :variant="previewDevice === 'mobile' ? 'default' : 'ghost'" class="size-6" aria-label="移动预览" @click="previewDevice = 'mobile'">
                  <PhonePortraitOutline class="size-3.5" />
                </Button>
              </div>
              <Button size="xs" variant="ghost" class="size-7" :aria-label="previewDark ? '切换亮色预览' : '切换暗色预览'" @click="previewDark = !previewDark">
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
                  :block-props="previewProps"
                  :theme="previewTheme"
                  :user-info="editor.account.value"
                  :page-mode="props.page ? 'custom' : 'block'"
                  :page-slug="editor.currentKey.value === 'home' ? null : editor.currentKey.value"
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
        <DialogTitle class="text-sm">粘贴代码</DialogTitle>
        <DialogDescription class="text-xs">
          浏览器剪贴板自动读取受限，请在下方输入框粘贴代码（Ctrl/⌘+V）后导入：
        </DialogDescription>
      </DialogHeader>
      <Textarea
        v-model="manualPasteText"
        class="h-36 font-mono resize-none"
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
  <Sheet v-model:open="apiReferenceOpen">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <SheetHeader class="shrink-0 border-b px-6 py-4 text-left">
        <SheetTitle>vtsuru API</SheetTitle>
        <SheetDescription>点击方法插入到光标处。允许 vue / dayjs / @vueuse/core。</SheetDescription>
      </SheetHeader>
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        <CustomHtmlApiReference @insert="insertApiSnippet" />
      </div>
    </SheetContent>
  </Sheet>
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
