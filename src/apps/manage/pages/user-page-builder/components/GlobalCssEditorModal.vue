<script setup lang="ts">
import MoonOutline from '@vicons/ionicons5/es/MoonOutline'
import SunnyOutline from '@vicons/ionicons5/es/SunnyOutline'
import { Eye, EyeOff } from 'lucide-vue-next'
import { computed, inject, ref, watch } from 'vue'

import { GLOBAL_CUSTOM_CSS_MAX_BYTES, utf8ByteLength } from '@/apps/user-page/block/customHtmlContract'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Tag } from '@/shared/ui/tag'
import { isDarkMode, useDialog } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import { usePreviewThemeContext, useScopedCustomCssPreview } from '../previewThemeContext'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()
const draft = ref('')
const initialSnapshot = ref('')
const codeEditor = ref<InstanceType<typeof CustomHtmlCodeEditor> | null>(null)
const showPreview = ref(true)
const previewDark = ref(isDarkMode.value)
const sampleText = ref('示例留言或检索关键词')

const cssBytes = computed(() => utf8ByteLength(draft.value))
const issues = computed(() => {
  const result = inspectCustomCss(draft.value)
  const next = [...result.issues]
  if (cssBytes.value > GLOBAL_CUSTOM_CSS_MAX_BYTES)
    next.push({ field: 'css', message: `CSS 不能超过 ${GLOBAL_CUSTOM_CSS_MAX_BYTES / 1024} KiB`, line: 1, column: 1 })
  return next
})
const isDirty = computed(() => draft.value !== initialSnapshot.value)
const monacoTheme = computed(() => (isDarkMode.value ? ('vs-dark' as const) : ('vs' as const)))

const previewThemeContext = usePreviewThemeContext({
  settings: () => editor.settings?.value,
  currentPage: () => editor.currentPage?.value,
  currentProject: () => editor.currentProject?.value,
  darkOverride: () => previewDark.value,
  respectPageThemeMode: false,
})

const previewStageStyle = computed<Record<string, string | undefined>>(() => ({
  ...previewThemeContext.bgVars.value,
  ...previewThemeContext.uiVars.value,
  backgroundColor: previewThemeContext.canvasColor.value,
  color: previewThemeContext.uiVars.value['--foreground'],
  colorScheme: previewDark.value ? 'dark' : 'light',
}))

useScopedCustomCssPreview('.global-css-preview-scope', () =>
  show.value && showPreview.value && !issues.value.length ? draft.value : '',
)

function resetDraft() {
  draft.value = typeof editor.settings.value.customCss === 'string' ? editor.settings.value.customCss : ''
  initialSnapshot.value = draft.value
}

function applyChanges() {
  if (issues.value.length) return
  const next = draft.value.trim()
  editor.batchHistory(() => {
    if (next) editor.settings.value.customCss = next
    else delete editor.settings.value.customCss
  })
  initialSnapshot.value = draft.value
  show.value = false
  editor.message.success('全局 CSS 已应用')
}

function closeEditor() {
  if (!isDirty.value) {
    show.value = false
    return
  }
  dialog.warning({
    title: '放弃未应用修改',
    content: '全局 CSS 中的修改尚未应用到公开页。',
    positiveText: '放弃修改',
    negativeText: '继续编辑',
    onPositiveClick: () => {
      show.value = false
    },
  })
}

watch(
  show,
  (visible) => {
    if (visible) resetDraft()
  },
  { immediate: true },
)
</script>

<template>
  <Dialog
    :open="show"
    @update:open="
      (val) => {
        if (!val) closeEditor()
        else show = true
      }
    "
  >
    <DialogContent class="max-w-[min(1280px,95vw)] h-[min(780px,90dvh)] p-0 flex flex-col gap-0 overflow-hidden">
      <DialogHeader class="p-4 border-b flex flex-row items-center justify-between shrink-0">
        <DialogTitle class="text-base"> 全局 CSS </DialogTitle>
        <DialogDescription class="sr-only">编辑作用于公开用户页的全局 CSS 并即时预览样式效果。</DialogDescription>
        <div class="flex items-center gap-2 pr-6">
          <Button
            size="xs"
            variant="outline"
            @click="showPreview = !showPreview"
          >
            <EyeOff
              v-if="showPreview"
              class="size-3.5"
            />
            <Eye
              v-else
              class="size-3.5"
            />
            {{ showPreview ? '收起预览' : '实时预览' }}
          </Button>
          <Tag
            v-if="issues.length"
            variant="destructive"
            size="small"
          >
            {{ issues.length }} 个问题
          </Tag>
          <Button
            variant="outline"
            @click="closeEditor"
          >
            取消
          </Button>
          <Button
            :disabled="!!issues.length"
            @click="applyChanges"
          >
            应用
          </Button>
        </div>
      </DialogHeader>

      <div
        class="editor-layout flex-1 min-h-0 grid grid-cols-1"
        :class="showPreview ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.9fr)]' : ''"
      >
        <div class="editor-shell flex-1 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r">
          <div class="px-3.5 pt-3 shrink-0">
            <Alert size="sm">
              <AlertDescription>
                CSS 作用于公开用户页，可使用 --foreground、--primary、--card、--border 等主题变量；不允许外部
                URL、@import 和脚本相关属性。
              </AlertDescription>
            </Alert>
          </div>
          <div class="flex justify-between items-center px-3.5 py-2 text-xs text-muted-foreground shrink-0">
            <span>公开页全局样式</span>
            <span>{{ cssBytes }}/{{ GLOBAL_CUSTOM_CSS_MAX_BYTES }} bytes</span>
          </div>
          <div class="flex-1 min-h-0">
            <CustomHtmlCodeEditor
              ref="codeEditor"
              :source="draft"
              language="css"
              :theme="monacoTheme"
              :assets="[]"
              :resources="[]"
              :issues="issues"
              @update:source="draft = $event"
            />
          </div>
        </div>

        <aside
          v-if="showPreview"
          class="flex min-h-0 flex-col bg-muted/10"
        >
          <div class="flex items-center justify-between px-3 py-2 border-b bg-card shrink-0">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-semibold text-foreground">样式示例预览</span>
              <Badge
                v-if="issues.length"
                variant="destructive"
                size="xs"
              >
                语法有误，暂未注入
              </Badge>
            </div>
            <Button
              size="icon-xs"
              variant="ghost"
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
          <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <div
              class="global-css-preview-scope user-page-shell min-h-full p-4 space-y-3 transition-colors duration-150"
              :class="{ dark: previewDark }"
              :style="previewStageStyle"
            >
              <Card class="user-page-block">
                <CardHeader class="pb-2">
                  <div class="flex items-center justify-between gap-2">
                    <CardTitle class="text-base">主播展示主页示例</CardTitle>
                    <Badge variant="secondary">LIVE</Badge>
                  </div>
                  <CardDescription>用于即时验证卡片、边框、主色与排版在自定义 CSS 下的表现。</CardDescription>
                </CardHeader>
                <CardContent class="space-y-3">
                  <div class="flex flex-wrap gap-2">
                    <Button>主按钮操作</Button>
                    <Button variant="outline">次要按钮</Button>
                    <Badge variant="outline">--primary / --radius</Badge>
                  </div>
                  <Input
                    v-model="sampleText"
                    placeholder="示例输入框"
                  />
                </CardContent>
              </Card>

              <Card class="user-page-block">
                <CardContent class="pt-4 space-y-1.5">
                  <div class="text-xs font-medium text-muted-foreground">快捷提示</div>
                  <p class="text-xs text-muted-foreground">
                    此处与主画布预览保持相同的主题变量作用域；输入合法 CSS 时会在示例区和主画布保存后同步生效。
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </aside>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.editor-shell :deep(.code-editor) {
  height: 100%;
  min-height: 0;
}
</style>
