<script setup lang="ts">
import {
  ColorPaletteOutline,
  ConstructOutline,
  GridOutline,
  LayersOutline,
  OpenOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import {
  NAlert,
  NAutoComplete,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDivider,
  NDropdown,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NProgress,
  NSelect,
  NSwitch,
  NTag,
  NText,
  NTooltip,
} from 'naive-ui'
import { computed, inject, ref, watch } from 'vue'

import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'
import type { UserPageConfig } from '@/apps/user-page/types'
import { getUserPageNavIconLabel, resolveUserPageNavIcon } from '@/apps/user-page/pageIcons'

import { UserPageEditorKey } from '../context'
import { PAGE_MODE_OPTIONS } from '../editorPageConfig'
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

const capacityStatus = computed(() => {
  if (editor.configBytes.value > editor.MAX_CONFIG_BYTES) return 'error'
  if (editor.configBytes.value > editor.MAX_CONFIG_BYTES * 0.9) return 'warning'
  return 'success'
})

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
    editor.currentPage.value.block = editor.createDefaultProject()
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
  <NCard
    class="block-property-editor"
    :title="isSelectingBlock ? '区块属性' : '页面配置'"
    style="width: 100%; height: 100%"
    content-style="padding: 12px; display: flex; flex-direction: column; gap: 12px; min-height: 0; overflow-y: auto"
  >
    <template #header-extra>
      <NFlex
        align="center"
        :wrap="false"
        style="gap: 6px; min-width: 0"
      >
        <NTooltip
          v-if="
            editor.currentKey.value !== 'home' &&
            editor.currentPage.value.mode === 'block' &&
            editor.currentProject.value
          "
        >
          <template #trigger>
            <NButton
              type="primary"
              secondary
              size="tiny"
              aria-label="编辑当前页面主题"
              @click="editor.pageThemeModal.value = true"
            >
              <template #icon>
                <NIcon><ColorPaletteOutline /></NIcon>
              </template>
              页面主题
            </NButton>
          </template>
          编辑当前子页面的背景与主题（未设置时继承全局主题）
        </NTooltip>
        <NText
          depth="3"
          style="font-size: 12px; white-space: nowrap"
        >
          容量 {{ editor.configBytesPercent.value }}%
        </NText>
        <NProgress
          type="line"
          :percentage="editor.configBytesPercent.value"
          :status="capacityStatus as any"
          :show-indicator="false"
          :height="6"
          style="width: 64px"
        />
      </NFlex>
    </template>

    <!-- 当处于具体区块选中状态时，顶部提供返回页面配置入口 -->
    <div
      v-if="isSelectingBlock"
      class="editing-block-banner"
    >
      <NFlex
        justify="space-between"
        align="center"
      >
        <NFlex
          align="center"
          :size="6"
        >
          <NIcon
            :component="ConstructOutline"
            style="color: var(--vtsuru-primary)"
          />
          <NText strong>
            {{ editor.selectedBlock.value ? `编辑区块 · ${editor.selectedBlock.value.type}` : `已选中 ${editor.selectedBlocks.value.length} 个区块` }}
          </NText>
        </NFlex>
        <NButton
          size="tiny"
          secondary
          @click="deselectBlock"
        >
          返回页面配置
        </NButton>
      </NFlex>
    </div>

    <!-- 页面级基础信息（非单区块编辑时完整呈现） -->
    <div
      v-if="!isSelectingBlock"
      class="page-mode-section"
    >
      <div class="section-title">
        <NText
          depth="2"
          style="font-size: 13px; font-weight: 600"
        >
          页面搭建模式
        </NText>
      </div>
      <div class="mode-cards-grid">
        <div
          v-for="opt in PAGE_MODE_OPTIONS"
          :key="opt.value"
          class="mode-card"
          :class="{ 'is-active': editor.currentPage.value.mode === opt.value }"
          @click="handleModeChange(opt.value)"
        >
          <div class="mode-card__header">
            <span class="mode-card__title">{{ opt.label }}</span>
            <NTag
              v-if="opt.tag"
              size="tiny"
              type="success"
              :bordered="false"
            >
              {{ opt.tag }}
            </NTag>
          </div>
          <div class="mode-card__desc">
            {{ opt.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- 子页面基本设置 (名称、导航图标、排序、Slug) -->
    <NCollapse
      v-if="!isSelectingBlock && editor.currentKey.value !== 'home'"
      v-model:expanded-names="expandedPageSections"
    >
      <NCollapseItem
        class="page-info-section"
        title="页面基本信息 (子页面属性)"
        name="page-info"
      >
        <NForm
          label-placement="top"
          size="small"
        >
          <PropsGrid>
            <NFormItem label="页面名称">
              <NInput
                v-model:value="editor.currentPage.value.title"
                placeholder="例如：我的作品 / 赞助支持"
              />
            </NFormItem>
            <NFormItem label="导航图标">
              <NButton
                style="width: 100%; justify-content: flex-start"
                @click="pageIconPickerShown = true"
              >
                <template #icon>
                  <NIcon :component="resolveUserPageNavIcon(editor.currentPage.value.navIcon)" />
                </template>
                {{ getUserPageNavIconLabel(editor.currentPage.value.navIcon) }}
              </NButton>
              <PageIconPickerModal
                v-model:show="pageIconPickerShown"
                :value="editor.currentPage.value.navIcon"
                @select="setCurrentPageNavIcon"
              />
            </NFormItem>
            <NFormItem label="在导航菜单中显示">
              <NFlex justify="end">
                <NSwitch
                  v-model:value="editor.currentPage.value.navVisible"
                  size="small"
                />
              </NFlex>
            </NFormItem>
            <NFormItem
              class="span-full"
              label="页面描述"
            >
              <NInput
                v-model:value="editor.currentPage.value.description"
                type="textarea"
                placeholder="可选描述，用于 SEO 和展示"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </NFormItem>
            <NFormItem label="排序权重">
              <NInputNumber
                v-model:value="editor.currentPage.value.navOrder"
                style="width: 100%"
                placeholder="数字越小越靠前"
              />
            </NFormItem>
            <NFormItem label="链接路径 (Slug)">
              <NFlex
                :wrap="false"
                style="width: 100%"
              >
                <NInput
                  v-model:value="pageSlug"
                  placeholder="例如 links / sponsor"
                  @keyup.enter="renameCurrentPage"
                />
                <NButton
                  :disabled="pageSlug === editor.currentKey.value"
                  @click="renameCurrentPage"
                >
                  修改
                </NButton>
              </NFlex>
            </NFormItem>
          </PropsGrid>
        </NForm>
      </NCollapseItem>

      <PageAppearanceOverrides />
    </NCollapse>

    <!-- 模式对应的主体内容区 -->
    <Transition
      name="fade-slide"
      mode="out-in"
    >
      <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}:${isSelectingBlock}`">
        <!-- 1. 经典模板模式 -->
        <template v-if="editor.currentPage.value.mode === 'legacy'">
          <NDivider
            style="margin: 4px 0 12px"
            title-placement="left"
          >
            经典模板配置
          </NDivider>
          <LegacyIndexSettings />
        </template>

        <!-- 2. 扩展组件页模式 -->
        <template v-else-if="editor.currentPage.value.mode === 'contrib'">
          <NDivider
            style="margin: 4px 0 12px"
            title-placement="left"
          >
            扩展组件参数
          </NDivider>
          <NForm
            label-placement="top"
            size="small"
          >
            <PropsGrid>
              <NFormItem label="作用域">
                <NSelect
                  v-model:value="editor.currentContrib.value!.scope"
                  :options="[
                    { label: '全局扩展', value: 'global' },
                    { label: '主播专属扩展', value: 'streamer' },
                  ]"
                />
              </NFormItem>
              <NFormItem label="页面组件 ID (pageId)">
                <NAutoComplete
                  v-model:value="editor.currentContrib.value!.pageId"
                  :options="editor.contribPageIdOptions.value"
                  placeholder="选择或输入 pageId"
                  clearable
                />
              </NFormItem>
              <NFormItem
                v-if="editor.currentContrib.value!.scope === 'streamer'"
                label="关联主播 ID"
              >
                <NInputNumber
                  :value="editor.account.value.id"
                  :disabled="true"
                  style="width: 100%"
                />
              </NFormItem>
            </PropsGrid>
          </NForm>

          <NAlert
            v-if="editor.contribConfigError.value"
            type="error"
            :show-icon="true"
            style="margin-top: 12px"
          >
            {{ editor.contribConfigError.value }}
          </NAlert>
          <NAlert
            v-else-if="editor.contribConfigLoading.value"
            type="info"
            :show-icon="true"
            style="margin-top: 12px"
          >
            扩展页配置加载中...
          </NAlert>
          <template v-else-if="editor.contribConfigItems.value">
            <NFlex
              justify="space-between"
              align="center"
              style="margin-top: 12px"
            >
              <NText strong> 页面配置 </NText>
              <NButton
                size="small"
                secondary
                @click="editor.resetContribConfigToDefault"
              >
                重置为默认
              </NButton>
            </NFlex>
            <ErrorBoundary title="配置面板渲染失败">
              <ContribConfigEditor
                :config="editor.contribConfigItems.value"
                :config-data="editor.currentContrib.value!.config as any"
              />
            </ErrorBoundary>
          </template>
          <NAlert
            v-else
            type="info"
            :show-icon="true"
            style="margin-top: 12px"
          >
            该扩展组件无需额外属性配置，保存并发布后可在对外页面中查看运行效果。
          </NAlert>
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
              class="multi-selection-panel"
            >
              <NText strong> 已选择 {{ editor.selectedBlocks.value.length }} 个区块 </NText>
              <NFlex size="small">
                <NButton
                  size="small"
                  secondary
                  @click="batchSetHidden(false)"
                >
                  显示
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="batchSetHidden(true)"
                >
                  隐藏
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="batchSetChrome('framed', true)"
                >
                  显示边框
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="batchSetChrome('framed', false)"
                >
                  隐藏边框
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="batchSetChrome('backgrounded', true)"
                >
                  显示背景
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="batchSetChrome('backgrounded', false)"
                >
                  透明背景
                </NButton>
              </NFlex>
              <NFlex size="small">
                <NButton
                  size="small"
                  type="primary"
                  secondary
                  @click="groupSelection"
                >
                  成组
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="duplicateSelection"
                >
                  创建副本
                </NButton>
                <NButton
                  size="small"
                  secondary
                  @click="editor.copyBlocksToClipboard(editor.selectedBlockIds.value)"
                >
                  复制
                </NButton>
                <NButton
                  size="small"
                  type="error"
                  secondary
                  @click="editor.removeBlocks(editor.selectedBlockIds.value)"
                >
                  删除
                </NButton>
              </NFlex>
            </div>

            <!-- 3.3 未选中区块时的页面工作台/概览卡片 -->
            <div
              v-else
              key="overview-workbench"
              class="page-overview-workbench"
            >
              <div class="workbench-stats">
                <NFlex
                  justify="space-between"
                  align="center"
                >
                  <NFlex
                    align="center"
                    :size="6"
                  >
                    <NIcon
                      :component="LayersOutline"
                      style="color: var(--vtsuru-primary)"
                    />
                    <NText strong> 页面区块概览 </NText>
                  </NFlex>
                  <NTag
                    size="small"
                    :bordered="false"
                    type="primary"
                  >
                    已添加 {{ blocksCount }} 个区块
                  </NTag>
                </NFlex>
                <div class="workbench-hint">
                  点击左侧区块列表或中间预览画布中的任意组件即可进入细节属性配置。
                </div>
              </div>

              <NDivider style="margin: 8px 0" />

              <div class="workbench-actions">
                <NText
                  depth="3"
                  style="font-size: 12px; margin-bottom: 8px; display: block"
                >
                  快速搭建操作
                </NText>
                <NFlex
                  vertical
                  :size="8"
                >
                  <NFlex
                    :size="8"
                    :wrap="false"
                  >
                    <NDropdown
                      :options="addBlockOptions"
                      trigger="click"
                      @select="(key) => handleAddBlockMenuSelect(String(key))"
                    >
                      <NButton
                        type="primary"
                        secondary
                        style="flex: 1"
                      >
                        <template #icon>
                          <NIcon><GridOutline /></NIcon>
                        </template>
                        添加区块
                      </NButton>
                    </NDropdown>

                    <NDropdown
                      :options="templateOptions"
                      trigger="click"
                      @select="(key) => insertTemplate(String(key))"
                    >
                      <NButton
                        secondary
                        style="flex: 1"
                      >
                        <template #icon>
                          <NIcon><SparklesOutline /></NIcon>
                        </template>
                        起始模板
                      </NButton>
                    </NDropdown>
                  </NFlex>

                  <NButton
                    v-if="editor.currentKey.value !== 'home'"
                    secondary
                    block
                    @click="editor.pageThemeModal.value = true"
                  >
                    <template #icon>
                      <NIcon><ColorPaletteOutline /></NIcon>
                    </template>
                    设置本页专属主题与背景
                  </NButton>
                </NFlex>
              </div>
            </div>
          </Transition>
        </template>
      </div>
    </Transition>

    <div style="margin-top: auto; padding-top: 8px">
      <NButton
        block
        secondary
        @click="editor.openPreview"
      >
        <template #icon>
          <NIcon><OpenOutline /></NIcon>
        </template>
        在新标签页打开对外预览
      </NButton>
    </div>

    <input
      ref="uploadInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="editor.onUploadChange"
    />
  </NCard>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.editing-block-banner {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--vtsuru-brand-tint, rgba(0, 150, 255, 0.08));
  border: 1px solid var(--vtsuru-brand-soft, rgba(0, 150, 255, 0.2));
}

.page-mode-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-card:hover {
  border-color: var(--vtsuru-primary);
  background: var(--vtsuru-bg-elevated);
}

.mode-card.is-active {
  border-color: var(--vtsuru-primary);
  background: var(--vtsuru-brand-tint, rgba(0, 150, 255, 0.08));
  box-shadow: 0 0 0 1px var(--vtsuru-primary);
}

.mode-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.mode-card__desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--vtsuru-fg-muted);
}

.page-overview-workbench {
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
}

.workbench-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workbench-hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.5;
}

.multi-selection-panel {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}
</style>
