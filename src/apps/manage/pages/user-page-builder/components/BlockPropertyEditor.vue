<script setup lang="ts">
import {
  ColorPaletteOutline,
  ConstructOutline,
  GridOutline,
  LayersOutline,
  OpenOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import { computed, inject, ref, watch } from 'vue'

import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'
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
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { UserPageEditorKey } from '../context'
import { PAGE_MODE_OPTIONS, createDefaultProject } from '../editorPageConfig'
import BlockTypeEditor from './BlockTypeEditor.vue'
import ErrorBoundary from './ErrorBoundary.vue'
import LegacyIndexSettings from './LegacyIndexSettings.vue'
import PageAppearanceOverrides from './PageAppearanceOverrides.vue'
import PageIconPickerModal from './PageIconPickerModal.vue'
import PropsGrid from './PropsGrid.vue'
import { useBlockManagerLibrary } from './useBlockManagerLibrary'
import { useBlockPropertyFocus } from './useBlockPropertyFocus'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const uploadInput = editor.uploadInput

const { expandedPageSections } = useBlockPropertyFocus()
const { templateOptions, addBlockOptions, insertTemplate, handleAddBlockMenuSelect } = useBlockManagerLibrary()
const pageSlug = ref(editor.currentKey.value)
const pageIconPickerShown = ref(false)

const blocksCount = computed(() => editor.currentProject.value?.blocks?.length ?? 0)
const isBlockMode = computed(() => editor.currentPage.value.mode === 'block')
const isSelectingBlock = computed(() => Boolean(editor.selectedBlock.value || editor.selectedBlocks.value.length > 0))

function setCurrentPageNavIcon(value: string | undefined) {
  editor.currentPage.value.navIcon = value
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
  <Card class="block-property-editor w-full h-full flex flex-col border border-border">
    <CardHeader class="p-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
      <CardTitle class="text-sm font-semibold">
        {{ isSelectingBlock ? '区块属性' : '页面配置' }}
      </CardTitle>

      <div class="flex items-center gap-2">
        <TooltipProvider
          v-if="
            editor.currentKey.value !== 'home' &&
            editor.currentPage.value.mode === 'block' &&
            editor.currentProject.value
          "
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                class="h-6 px-2"
                @click="editor.pageThemeModal.value = true"
              >
                <component
                  :is="ColorPaletteOutline"
                  class="size-3.5 mr-1"
                />
                页面主题
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs"> 编辑当前子页面的背景与主题（未设置时继承全局主题） </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span class="text-xs text-muted-foreground whitespace-nowrap">
          容量 {{ editor.configBytesPercent.value }}%
        </span>
        <Progress
          :model-value="editor.configBytesPercent.value"
          class="w-16 h-1.5"
        />
      </div>
    </CardHeader>

    <CardContent class="p-3 flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
      <!-- 当处于具体区块选中状态时，顶部提供返回页面配置入口 -->
      <div
        v-if="isSelectingBlock"
        class="py-2 px-2.5 rounded-md bg-[var(--brand-tint,rgba(0,150,255,0.08))] border border-[var(--brand-soft,rgba(0,150,255,0.2))]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-semibold">
            <component
              :is="ConstructOutline"
              class="size-4 text-primary"
            />
            <span>
              {{
                editor.selectedBlock.value
                  ? `编辑区块 · ${editor.selectedBlock.value.type}`
                  : `已选中 ${editor.selectedBlocks.value.length} 个区块`
              }}
            </span>
          </div>
          <Button
            variant="outline"
            class="h-6 px-2"
            @click="deselectBlock"
          >
            返回页面配置
          </Button>
        </div>
      </div>

      <!-- 页面级基础信息（非单区块编辑时完整呈现） -->
      <div
        v-if="!isSelectingBlock"
        class="flex flex-col gap-2"
      >
        <div>
          <span class="text-xs font-semibold text-foreground">页面搭建模式</span>
        </div>
        <div class="flex flex-col gap-2">
          <div
            v-for="opt in PAGE_MODE_OPTIONS"
            :key="opt.value"
            class="py-2.5 px-3 rounded-lg border border-border bg-muted cursor-pointer transition flex flex-col gap-1 hover:border-primary hover:bg-popover"
            :class="{
              'border-primary bg-[var(--brand-tint,rgba(0,150,255,0.08))] shadow-[0_0_0_1px_var(--primary)]':
                editor.currentPage.value.mode === opt.value,
            }"
            @click="handleModeChange(opt.value)"
          >
            <div class="flex-between">
              <span class="text-[13px] font-semibold text-foreground">{{ opt.label }}</span>
              <Tag
                v-if="opt.tag"
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
              >
                {{ opt.tag }}
              </Tag>
            </div>
            <div class="text-xs leading-snug text-muted-foreground">
              {{ opt.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- 子页面基本设置 (名称、导航图标、排序、Slug) -->
      <Accordion
        v-if="!isSelectingBlock && editor.currentKey.value !== 'home'"
        v-model="expandedPageSections"
        type="multiple"
        class="w-full border rounded-lg p-2 bg-card"
      >
        <AccordionItem
          value="page-info"
          class="border-b-0"
        >
          <AccordionTrigger class="text-xs font-semibold py-2"> 页面基本信息 (子页面属性) </AccordionTrigger>
          <AccordionContent class="pt-2 pb-1">
            <PropsGrid>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">页面名称</label>
                <Input
                  v-model="editor.currentPage.value.title"
                  placeholder="例如：我的作品 / 赞助支持"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">导航图标</label>
                <Button
                  variant="outline"
                  class="justify-start"
                  @click="pageIconPickerShown = true"
                >
                  <component
                    :is="resolveUserPageNavIcon(editor.currentPage.value.navIcon)"
                    class="size-3.5 mr-1.5"
                  />
                  {{ getUserPageNavIconLabel(editor.currentPage.value.navIcon) }}
                </Button>
                <PageIconPickerModal
                  v-model:show="pageIconPickerShown"
                  :value="editor.currentPage.value.navIcon"
                  @select="setCurrentPageNavIcon"
                />
              </div>

              <div class="flex items-center justify-between pt-4">
                <label class="text-xs text-muted-foreground">在导航菜单中显示</label>
                <Switch
                  :checked="editor.currentPage.value.navVisible"
                  @update:checked="editor.currentPage.value.navVisible = $event"
                />
              </div>

              <div class="span-full flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">页面描述</label>
                <Textarea
                  v-model="editor.currentPage.value.description"
                  placeholder="可选描述，用于 SEO 和展示"
                  rows="2"
                  class="text-xs"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">排序权重</label>
                <NumberField
                  v-model="editor.currentPage.value.navOrder"
                  placeholder="数字越小越靠前"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">链接路径 (Slug)</label>
                <div class="flex items-center gap-1.5">
                  <Input
                    v-model="pageSlug"
                    placeholder="例如 links / sponsor"
                    class="flex-1"
                    @keyup.enter="renameCurrentPage"
                  />
                  <Button
                    variant="outline"
                    class="px-2"
                    :disabled="pageSlug === editor.currentKey.value"
                    @click="renameCurrentPage"
                  >
                    修改
                  </Button>
                </div>
              </div>
            </PropsGrid>
          </AccordionContent>
        </AccordionItem>

        <PageAppearanceOverrides />
      </Accordion>

      <!-- 模式对应的主体内容区 -->
      <Transition
        name="fade-slide"
        mode="out-in"
      >
        <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}:${isSelectingBlock}`">
          <!-- 1. 经典模板模式 -->
          <template v-if="editor.currentPage.value.mode === 'legacy'">
            <div class="text-xs font-semibold text-muted-foreground uppercase pt-2 pb-1 border-t border-border">
              经典模板配置
            </div>
            <LegacyIndexSettings />
          </template>

          <!-- 2. 扩展组件页模式 -->
          <template v-else-if="editor.currentPage.value.mode === 'contrib'">
            <div class="text-xs font-semibold text-muted-foreground uppercase pt-2 pb-1 border-t border-border">
              扩展组件参数
            </div>
            <PropsGrid>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">作用域</label>
                <Select v-model="editor.currentContrib.value!.scope">
                  <SelectTrigger>
                    <SelectValue placeholder="作用域" />
                  </SelectTrigger>
                  <SelectContent class="text-xs">
                    <SelectItem value="global">全局扩展</SelectItem>
                    <SelectItem value="streamer">主播专属扩展</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">页面组件 ID (pageId)</label>
                <Input
                  v-model="editor.currentContrib.value!.pageId"
                  placeholder="选择或输入 pageId"
                />
              </div>

              <div
                v-if="editor.currentContrib.value!.scope === 'streamer'"
                class="flex flex-col gap-1"
              >
                <label class="text-xs text-muted-foreground">关联主播 ID</label>
                <Input
                  :model-value="String(editor.account.value.id ?? '')"
                  disabled
                />
              </div>
            </PropsGrid>

            <Alert
              v-if="editor.contribConfigError.value"
              variant="destructive"
              class="mt-3 py-2 text-xs"
            >
              <AlertDescription>
                {{ editor.contribConfigError.value }}
              </AlertDescription>
            </Alert>
            <Alert
              v-else-if="editor.contribConfigLoading.value"
              class="mt-3 py-2 text-xs"
            >
              <AlertDescription> 扩展页配置加载中... </AlertDescription>
            </Alert>
            <template v-else-if="editor.contribConfigItems.value">
              <div class="flex items-center justify-between mt-3 mb-2">
                <span class="text-xs font-semibold">页面配置</span>
                <Button
                  variant="outline"
                  class="h-6 px-2"
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
              class="mt-3 py-2 text-xs"
            >
              <AlertDescription>
                该扩展组件无需额外属性配置，保存并发布后可在对外页面中查看运行效果。
              </AlertDescription>
            </Alert>
          </template>

          <!-- 3. 可视化自由搭建 (区块模式) -->
          <template v-else-if="isBlockMode && editor.currentProject.value">
            <Transition
              name="fade-slide"
              mode="out-in"
            >
              <!-- 3.1 单区块属性编辑 -->
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

              <!-- 3.2 多区块批量操作面板 -->
              <div
                v-else-if="editor.selectedBlocks.value.length > 1"
                key="multi"
                class="grid gap-2 mt-2 p-2.5 border border-border rounded-md bg-muted"
              >
                <span class="text-xs font-semibold">已选择 {{ editor.selectedBlocks.value.length }} 个区块</span>
                <div class="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetHidden(false)"
                  >
                    显示
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetHidden(true)"
                  >
                    隐藏
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetChrome('framed', true)"
                  >
                    显示边框
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetChrome('framed', false)"
                  >
                    隐藏边框
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetChrome('backgrounded', true)"
                  >
                    显示背景
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="batchSetChrome('backgrounded', false)"
                  >
                    透明背景
                  </Button>
                </div>
                <div class="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  <Button
                    class="h-6 px-2"
                    @click="groupSelection"
                  >
                    成组
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="duplicateSelection"
                  >
                    创建副本
                  </Button>
                  <Button
                    variant="outline"
                    class="h-6 px-2"
                    @click="editor.copyBlocksToClipboard(editor.selectedBlockIds.value)"
                  >
                    复制
                  </Button>
                  <Button
                    variant="destructive"
                    class="h-6 px-2"
                    @click="editor.removeBlocks(editor.selectedBlockIds.value)"
                  >
                    删除
                  </Button>
                </div>
              </div>

              <!-- 3.3 未选中区块时的页面工作台/概览卡片 -->
              <div
                v-else
                key="overview-workbench"
                class="p-3 border border-border rounded-lg bg-muted"
              >
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 text-xs font-semibold">
                      <component
                        :is="LayersOutline"
                        class="size-4 text-primary"
                      />
                      <span>页面区块概览</span>
                    </div>
                    <Badge
                      variant="secondary"
                      class="text-[10px] h-4.5 px-1.5"
                    >
                      已添加 {{ blocksCount }} 个区块
                    </Badge>
                  </div>
                  <div class="text-xs text-muted-foreground leading-normal">
                    点击左侧区块列表或中间预览画布中的任意组件即可进入细节属性配置。
                  </div>
                </div>

                <div class="h-px bg-border my-2" />

                <div class="workbench-actions">
                  <span class="text-xs text-muted-foreground mb-2 block font-medium">快速搭建操作</span>
                  <div class="flex flex-col gap-2">
                    <div class="grid grid-cols-2 gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button>
                            <component
                              :is="GridOutline"
                              class="size-3.5 mr-1"
                            />
                            添加区块
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-56 max-h-72 overflow-y-auto text-xs">
                          <template
                            v-for="opt in addBlockOptions"
                            :key="opt.key"
                          >
                            <DropdownMenuSeparator
                              v-if="opt.type === 'divider' || String(opt.key).startsWith('divider:')"
                            />
                            <DropdownMenuLabel
                              v-if="opt.disabled"
                              class="text-xs font-bold text-muted-foreground"
                            >
                              {{ typeof opt.label === 'function' ? '分组' : opt.label }}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              v-else
                              class="text-xs"
                              @click="handleAddBlockMenuSelect(String(opt.key))"
                            >
                              <component
                                :is="opt.icon"
                                v-if="opt.icon"
                                class="size-3.5 mr-2"
                              />
                              {{ typeof opt.label === 'function' ? '' : opt.label }}
                            </DropdownMenuItem>
                          </template>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="outline">
                            <component
                              :is="SparklesOutline"
                              class="size-3.5 mr-1"
                            />
                            起始模板
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-48 text-xs">
                          <DropdownMenuItem
                            v-for="opt in templateOptions"
                            :key="opt.key"
                            class="text-xs"
                            @click="insertTemplate(String(opt.key))"
                          >
                            {{ opt.label }}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Button
                      variant="outline"
                      class="w-full"
                      @click="editor.pageThemeModal.value = true"
                    >
                      <component
                        :is="ColorPaletteOutline"
                        class="size-3.5 mr-1"
                      />
                      {{ editor.currentKey.value === 'home' ? '设置主页外观与全局主题' : '设置本页专属主题与背景' }}
                    </Button>
                  </div>
                </div>
              </div>
            </Transition>
          </template>
        </div>
      </Transition>

      <div class="mt-auto pt-2">
        <Button
          variant="outline"
          class="w-full"
          @click="editor.openPreview"
        >
          <component
            :is="OpenOutline"
            class="size-3.5 mr-1"
          />
          在新标签页打开对外预览
        </Button>
      </div>

      <input
        ref="uploadInput"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="editor.onUploadChange"
      />
    </CardContent>
  </Card>
</template>

<style scoped src="./ui-transitions.css"></style>
