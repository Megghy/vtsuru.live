<script setup lang="ts">
import {
  ArrowLeft,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Palette,
  Sliders,
  Sparkles,
} from 'lucide-vue-next'
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'

import { createDefaultCustomPageProps } from '@/apps/user-page/block/customHtmlContract'
import { getBlockLabel } from '@/apps/user-page/block/registry'
import { listContribPageRefs } from '@/apps/user-page/contrib/registry'
import { getUserPageNavIconLabel, resolveUserPageNavIcon } from '@/apps/user-page/pageIcons'
import type { UserPageConfig } from '@/apps/user-page/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { UserPageEditorKey } from '../context'
import { createDefaultProject, getAvailablePageModeOptions } from '../editorPageConfig'
import BlockTypeEditor from './BlockTypeEditor.vue'
import ErrorBoundary from './ErrorBoundary.vue'
import PropsGrid from './PropsGrid.vue'
import { useBlockManagerLibrary } from './useBlockManagerLibrary'
import { useBlockPropertyFocus } from './useBlockPropertyFocus'

const ContribConfigEditor = defineAsyncComponent(() => import('@/apps/manage/components/ContribConfigEditor.vue'))
const CustomPageSettings = defineAsyncComponent(() => import('./CustomPageSettings.vue'))
const LegacyIndexSettings = defineAsyncComponent(() => import('./LegacyIndexSettings.vue'))
const PageAppearanceOverrides = defineAsyncComponent(() => import('./PageAppearanceOverrides.vue'))
const PageIconPickerModal = defineAsyncComponent(() => import('./PageIconPickerModal.vue'))

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const { expandedPageSections } = useBlockPropertyFocus()
const { templateOptions, addBlockOptions, insertTemplate, handleAddBlockMenuSelect } = useBlockManagerLibrary()
const pageSlug = ref(editor.currentKey.value)
const pageIconPickerShown = ref(false)
const hasOpenedPageIconPicker = ref(false)
watch(
  pageIconPickerShown,
  (val) => {
    if (val) hasOpenedPageIconPicker.value = true
  },
  { immediate: true },
)

const isHome = computed(() => editor.currentKey.value === 'home')
const blocksCount = computed(() => editor.currentProject.value?.blocks?.length ?? 0)
const isBlockMode = computed(() => editor.currentPage.value.mode === 'block')
const isSelectingBlock = computed(() => Boolean(editor.selectedBlock.value || editor.selectedBlocks.value.length > 0))
const availableModeOptions = computed(() => getAvailablePageModeOptions(isHome.value, editor.currentPage.value.mode))
const currentModeMeta = computed(() =>
  availableModeOptions.value.find((opt) => opt.value === editor.currentPage.value.mode),
)

const contribPageOptions = computed(() => {
  const contrib = editor.currentContrib.value
  const scope = contrib?.scope ?? 'global'
  const accountId = Number(editor.account.value.id ?? 0)
  return listContribPageRefs()
    .filter((item) => item.scope === scope && (scope === 'global' || item.streamerId === accountId))
    .map((item) => item.pageId)
})

const ogPreviewUrl = computed(() => {
  const page = editor.currentPage.value as Record<string, any>
  if (typeof page.ogImageFile?.path === 'string' && page.ogImageFile.path) return page.ogImageFile.path
  if (typeof page.ogImageUrl === 'string' && /^https:\/\//i.test(page.ogImageUrl.trim())) return page.ogImageUrl.trim()
  return ''
})

const capacityStatusClass = computed(() => {
  if (editor.configBytesPercent.value >= 90) return 'text-destructive font-medium'
  if (editor.configBytesPercent.value >= 75) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-muted-foreground'
})

function formatBytesShort(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function setCurrentPageNavIcon(value: string | undefined) {
  editor.currentPage.value.navIcon = value
}

function clearPageOgImage() {
  delete (editor.currentPage.value as Record<string, any>).ogImageFile
}

watch(editor.currentKey, (key) => (pageSlug.value = key))

function renameCurrentPage() {
  try {
    editor.renamePage(editor.currentKey.value, pageSlug.value)
  } catch (error) {
    pageSlug.value = editor.currentKey.value
    editor.message.error((error as Error).message || String(error))
  }
}

function handleModeChange(newMode: UserPageConfig['mode']) {
  if (editor.currentPage.value.mode === newMode) return
  editor.currentPage.value.mode = newMode
  if (newMode === 'block' && !editor.currentPage.value.block) {
    editor.currentPage.value.block = createDefaultProject()
  } else if (newMode === 'contrib' && !editor.currentPage.value.contrib) {
    editor.currentPage.value.contrib = { scope: 'global', pageId: '' }
  } else if (newMode === 'custom' && !editor.currentPage.value.custom) {
    editor.currentPage.value.custom = createDefaultCustomPageProps()
  }
  editor.clearSelection()
}

function deselectBlock() {
  editor.clearSelection()
}

function batchSetHidden(hidden: boolean) {
  editor.setBlocksHidden(editor.selectedBlockIds.value, hidden)
}

function batchSetChrome(key: 'framed' | 'backgrounded', value: boolean) {
  editor.batchHistory(() => {
    editor.selectedBlocks.value.forEach((block) => {
      editor.ensurePropsObject(block)[key] = value
    })
  })
}

function duplicateSelection() {
  const ids = editor.selectedBlockIds.value
  editor.copyBlocksToClipboard(ids)
  editor.pasteBlocksAfter(ids.at(-1) ?? null)
}

function groupSelection() {
  const ids = editor.selectedBlockIds.value
  if (ids.length > 1) editor.groupBlocksIntoLayout(ids[1], ids[0])
}
</script>

<template>
  <Card class="pane-card block-property-editor w-full h-full flex flex-col">
    <CardHeader class="h-10 px-3 py-0 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
      <CardTitle class="text-xs font-semibold">
        {{ isSelectingBlock ? '区块属性' : '页面配置' }}
      </CardTitle>

      <div class="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                @click="editor.pageThemeModal.value = true"
              >
                <Palette class="size-3.5 text-primary" />
                <span>{{ isHome ? '外观' : '本页主题' }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ isHome ? '编辑主页外观与全局主题' : '编辑当前子页面的专属背景与主题（未设置时继承全局）' }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1.5 cursor-help">
                <span
                  class="text-[11px] whitespace-nowrap tabular-nums"
                  :class="capacityStatusClass"
                >
                  {{ editor.configBytesPercent.value }}%
                </span>
                <Progress
                  :model-value="editor.configBytesPercent.value"
                  class="w-12 h-1.5"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              配置容量：{{ formatBytesShort(editor.configBytes.value) }} / 上限
              {{ formatBytesShort(editor.MAX_CONFIG_BYTES) }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>

    <CardContent class="p-3 flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-thin">
      <!-- 选中区块时的返回条 -->
      <div
        v-if="isSelectingBlock"
        class="py-2 px-2.5 rounded-lg bg-primary/8 border border-primary/25"
      >
        <div class="flex-between gap-2">
          <div class="flex items-center gap-1.5 text-xs font-semibold min-w-0">
            <Sliders class="size-3.5 text-primary shrink-0" />
            <span class="truncate">
              {{
                editor.selectedBlock.value
                  ? editor.selectedBlock.value.name?.trim() || getBlockLabel(editor.selectedBlock.value.type)
                  : `已选中 ${editor.selectedBlocks.value.length} 个区块`
              }}
            </span>
          </div>
          <Button
            size="xs"
            variant="outline"
            class="gap-1 shrink-0"
            @click="deselectBlock"
          >
            <ArrowLeft class="size-3" />
            页面配置
          </Button>
        </div>
      </div>

      <!-- 紧凑模式切换器（不再占满大半屏） -->
      <div
        v-if="!isSelectingBlock"
        class="space-y-1.5"
      >
        <FormField
          label="页面搭建模式"
          :description="currentModeMeta?.description"
        >
          <ToggleGroup
            type="single"
            :model-value="editor.currentPage.value.mode"
            class="w-full grid"
            :style="{ gridTemplateColumns: `repeat(${availableModeOptions.length}, minmax(0, 1fr))` }"
            @update:model-value="(val) => val && handleModeChange(val as UserPageConfig['mode'])"
          >
            <ToggleGroupItem
              v-for="opt in availableModeOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label.replace('可视化自由搭建', '自由搭建').replace('自定义代码页', '自定义代码') }}
            </ToggleGroupItem>
          </ToggleGroup>
        </FormField>
      </div>

      <!-- 页面基本信息与社交分享卡片（主页与子页均可用） -->
      <Accordion
        v-if="!isSelectingBlock"
        v-model="expandedPageSections"
        type="multiple"
        class="w-full border border-border rounded-lg px-2.5 py-1 bg-card"
      >
        <AccordionItem
          value="page-info"
          class="page-info-section border-b-0"
        >
          <AccordionTrigger class="text-xs font-semibold py-2">
            {{ isHome ? '主页信息与分享卡片 (SEO)' : '页面信息、导航与分享卡片' }}
          </AccordionTrigger>
          <AccordionContent class="pt-2 pb-1 space-y-3">
            <PropsGrid>
              <FormField
                :label="isHome ? '主页标题（浏览器标签与分享标题）' : '页面名称'"
                :class="isHome ? 'span-full' : ''"
                data-validation-field="title"
              >
                <Input
                  v-model="editor.currentPage.value.title"
                  maxlength="100"
                  :placeholder="isHome ? '留空默认显示“主页”' : '例如：我的作品 / 赞助支持'"
                />
              </FormField>

              <FormField
                v-if="!isHome"
                label="导航图标"
                data-validation-field="navIcon"
              >
                <Button
                  variant="outline"
                  class="w-full justify-start gap-1.5"
                  @click="pageIconPickerShown = true"
                >
                  <component
                    :is="resolveUserPageNavIcon(editor.currentPage.value.navIcon)"
                    class="size-3.5 shrink-0"
                  />
                  <span class="truncate">{{ getUserPageNavIconLabel(editor.currentPage.value.navIcon) }}</span>
                </Button>
                <PageIconPickerModal
                  v-if="hasOpenedPageIconPicker || pageIconPickerShown"
                  v-model:show="pageIconPickerShown"
                  :value="editor.currentPage.value.navIcon"
                  @select="setCurrentPageNavIcon"
                />
              </FormField>

              <FormField
                label="页面简介（SEO 与分享摘要）"
                class="span-full"
                data-validation-field="description"
              >
                <Textarea
                  v-model="editor.currentPage.value.description"
                  maxlength="300"
                  placeholder="转发链接到 B站 / QQ / 微信 时展示的简介"
                  rows="2"
                />
              </FormField>

              <FormField
                label="社交分享封面图 (og:image)"
                description="建议 1200×630 横图；留空时默认使用主播头像"
                class="span-full"
                data-validation-field="ogImageFile"
              >
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    class="gap-1.5"
                    :disabled="editor.isUploading.value"
                    @click="editor.triggerUploadTargetImage(() => editor.currentPage.value as any, 'ogImageFile')"
                  >
                    <ImageIcon class="size-3.5" />
                    上传封面
                  </Button>
                  <Button
                    variant="ghost"
                    :disabled="!(editor.currentPage.value as any).ogImageFile"
                    @click="clearPageOgImage"
                  >
                    清除
                  </Button>
                  <ImagePreview
                    v-if="ogPreviewUrl"
                    :src="ogPreviewUrl"
                    alt="分享封面预览"
                    class="size-8 rounded border border-border shrink-0"
                  />
                </div>
              </FormField>

              <template v-if="!isHome">
                <SettingRow
                  title="在导航菜单中显示"
                  variant="none"
                  class="span-full py-1"
                >
                  <Switch
                    :checked="editor.currentPage.value.navVisible"
                    @update:checked="editor.currentPage.value.navVisible = $event"
                  />
                </SettingRow>

                <FormField label="排序权重">
                  <NumberField
                    v-model="editor.currentPage.value.navOrder"
                    placeholder="数字越小越靠前"
                  />
                </FormField>

                <FormField label="链接路径 (Slug)">
                  <div class="flex items-center gap-1.5">
                    <Input
                      v-model="pageSlug"
                      placeholder="例如 links / sponsor"
                      class="flex-1 min-w-0"
                      @keyup.enter="renameCurrentPage"
                    />
                    <Button
                      variant="outline"
                      :disabled="pageSlug === editor.currentKey.value"
                      @click="renameCurrentPage"
                    >
                      修改
                    </Button>
                  </div>
                </FormField>
              </template>
            </PropsGrid>
          </AccordionContent>
        </AccordionItem>

        <PageAppearanceOverrides v-if="!isHome" />
      </Accordion>

      <!-- 模式对应的主体内容区 -->
      <Transition
        name="fade-slide"
        mode="out-in"
      >
        <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}:${isSelectingBlock}`">
          <CustomPageSettings v-if="editor.currentPage.value.mode === 'custom'" />

          <template v-else-if="editor.currentPage.value.mode === 'legacy'">
            <div class="text-xs font-semibold text-muted-foreground pt-1 pb-1.5 border-t border-border">
              经典模板配置
            </div>
            <LegacyIndexSettings />
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'contrib'">
            <div class="text-xs font-semibold text-muted-foreground pt-1 pb-1.5 border-t border-border">
              扩展组件参数
            </div>
            <PropsGrid>
              <FormField label="作用域">
                <Select v-model="editor.currentContrib.value!.scope">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="作用域" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">全局扩展</SelectItem>
                    <SelectItem value="streamer">主播专属扩展</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="页面组件 ID (pageId)">
                <div class="flex flex-col gap-1.5">
                  <Select
                    v-if="contribPageOptions.length"
                    :model-value="
                      contribPageOptions.includes(editor.currentContrib.value!.pageId)
                        ? editor.currentContrib.value!.pageId
                        : ''
                    "
                    @update:model-value="
                      (val) => {
                        if (typeof val === 'string' && val) editor.currentContrib.value!.pageId = val
                      }
                    "
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="从已注册组件中选择（或下方手动输入）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="pid in contribPageOptions"
                        :key="pid"
                        :value="pid"
                      >
                        {{ pid }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    v-model="editor.currentContrib.value!.pageId"
                    placeholder="选择或输入 pageId"
                  />
                </div>
              </FormField>

              <FormField
                v-if="editor.currentContrib.value!.scope === 'streamer'"
                label="关联主播 ID"
              >
                <Input
                  :model-value="String(editor.account.value.id ?? '')"
                  disabled
                />
              </FormField>
            </PropsGrid>

            <Alert
              v-if="editor.contribConfigError.value"
              variant="destructive"
              class="mt-3"
            >
              <AlertDescription>{{ editor.contribConfigError.value }}</AlertDescription>
            </Alert>
            <Alert
              v-else-if="editor.contribConfigLoading.value"
              class="mt-3"
            >
              <AlertDescription>扩展页配置加载中...</AlertDescription>
            </Alert>
            <template v-else-if="editor.contribConfigItems.value">
              <div class="flex-between mt-3 mb-2">
                <span class="text-xs font-semibold">页面配置</span>
                <Button
                  size="xs"
                  variant="outline"
                  @click="editor.resetContribConfigToDefault"
                >
                  重置为默认
                </Button>
              </div>
              <ErrorBoundary title="配置面板渲染失败">
                <ContribConfigEditor
                  :config="editor.contribConfigItems.value"
                  :config-data="editor.currentContrib.value!.config as any"
                />
              </ErrorBoundary>
            </template>
            <Alert
              v-else
              class="mt-3"
            >
              <AlertDescription>
                该扩展组件无需额外属性配置，保存并发布后可在对外页面中查看运行效果。
              </AlertDescription>
            </Alert>
          </template>

          <template v-else-if="isBlockMode && editor.currentProject.value">
            <Transition
              name="fade-slide"
              mode="out-in"
            >
              <!-- 单区块属性编辑 -->
              <div
                v-if="editor.selectedBlock.value"
                :key="`selected:${editor.selectedBlock.value.id}`"
                data-block-property-editor
                class="block-editor-wrapper"
              >
                <ErrorBoundary title="区块属性面板渲染失败">
                  <BlockTypeEditor :block="editor.selectedBlock.value" />
                </ErrorBoundary>
              </div>

              <!-- 多区块批量操作面板 -->
              <div
                v-else-if="editor.selectedBlocks.value.length > 1"
                key="multi"
                class="grid gap-2 mt-1 p-2.5 border border-border rounded-lg bg-muted/50"
              >
                <span class="text-xs font-semibold">已选择 {{ editor.selectedBlocks.value.length }} 个区块</span>
                <div class="flex flex-wrap gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetHidden(false)"
                  >
                    显示
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetHidden(true)"
                  >
                    隐藏
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetChrome('framed', true)"
                  >
                    显示边框
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetChrome('framed', false)"
                  >
                    隐藏边框
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetChrome('backgrounded', true)"
                  >
                    显示背景
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="batchSetChrome('backgrounded', false)"
                  >
                    透明背景
                  </Button>
                </div>
                <div class="flex flex-wrap gap-1.5 pt-1.5 border-t border-border">
                  <Button
                    size="xs"
                    @click="groupSelection"
                  >
                    成组
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="duplicateSelection"
                  >
                    创建副本
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    @click="editor.copyBlocksToClipboard(editor.selectedBlockIds.value)"
                  >
                    复制
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    @click="editor.removeBlocks(editor.selectedBlockIds.value)"
                  >
                    删除
                  </Button>
                </div>
              </div>

              <!-- 未选中区块时的页面工作台概览 -->
              <div
                v-else
                key="overview-workbench"
                class="p-3 border border-border rounded-lg bg-muted/40 space-y-2.5"
              >
                <div class="flex flex-col gap-1">
                  <div class="flex-between">
                    <div class="flex items-center gap-1.5 text-xs font-semibold">
                      <Layers class="size-3.5 text-primary" />
                      <span>页面区块概览</span>
                    </div>
                    <Badge
                      variant="secondary"
                      size="xs"
                    >
                      已添加 {{ blocksCount }} 个区块
                    </Badge>
                  </div>
                  <div class="text-xs text-muted-foreground leading-relaxed">
                    点击左侧区块树或中间预览画布中的任意组件即可进入细节配置。
                  </div>
                </div>

                <Separator />

                <div class="space-y-2">
                  <div class="grid grid-cols-2 gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button class="gap-1.5">
                          <LayoutGrid class="size-3.5" />
                          添加区块
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent class="w-56 max-h-72 overflow-y-auto scrollbar-thin">
                        <template
                          v-for="opt in addBlockOptions"
                          :key="opt.key"
                        >
                          <template v-if="opt.groupLabel">
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel class="text-[11px] font-semibold text-muted-foreground">
                              {{ opt.groupLabel }}
                            </DropdownMenuLabel>
                          </template>
                          <DropdownMenuItem
                            v-else
                            @click="handleAddBlockMenuSelect(String(opt.key))"
                          >
                            <component
                              :is="opt.icon"
                              v-if="opt.icon"
                              class="size-3.5 mr-2"
                            />
                            {{ opt.label }}
                          </DropdownMenuItem>
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="outline"
                          class="gap-1.5"
                        >
                          <Sparkles class="size-3.5" />
                          起始模板
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent class="w-52">
                        <DropdownMenuItem
                          v-for="opt in templateOptions"
                          :key="opt.key"
                          @click="insertTemplate(String(opt.key))"
                        >
                          {{ opt.label }}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Button
                    variant="outline"
                    class="w-full gap-1.5"
                    @click="editor.pageThemeModal.value = true"
                  >
                    <Palette class="size-3.5 text-primary" />
                    {{ isHome ? '设置主页外观与全局主题' : '设置本页专属主题与背景' }}
                  </Button>
                </div>
              </div>
            </Transition>
          </template>
        </div>
      </Transition>
    </CardContent>
  </Card>
</template>

<style scoped src="./ui-transitions.css"></style>
