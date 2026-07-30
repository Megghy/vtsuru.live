<script setup lang="ts">
import { NAlert, NAutoComplete, NButton, NCard, NCollapse, NCollapseItem, NDivider, NDropdown, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NProgress, NRadioButton, NRadioGroup, NSelect, NSwitch, NText, NTooltip } from 'naive-ui';
import { computed, inject, ref, watch } from 'vue'
import { ColorPaletteOutline } from '@vicons/ionicons5'
import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'
import { UserPageEditorKey } from '../context'
import BlockTypeEditor from './BlockTypeEditor.vue'
import ErrorBoundary from './ErrorBoundary.vue'
import LegacyIndexSettings from './LegacyIndexSettings.vue'
import PageAppearanceOverrides from './PageAppearanceOverrides.vue'
import PropsGrid from './PropsGrid.vue'
import { useBlockPropertyFocus } from './useBlockPropertyFocus'
import { useBlockManagerLibrary } from './useBlockManagerLibrary'

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

watch(editor.currentKey, key => pageSlug.value = key)

function renameCurrentPage() {
  try {
    editor.renamePage(editor.currentKey.value, pageSlug.value)
  } catch (error) {
    pageSlug.value = editor.currentKey.value
    editor.message.error((error as Error).message || String(error))
  }
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
    title="编辑"
    style="width: 100%; height: 100%"
    content-style="padding: 12px"
  >
    <template #header-extra>
      <NFlex align="center" :wrap="false" style="gap: 6px; min-width: 0">
        <NTooltip
          v-if="editor.currentKey.value !== 'home' && editor.currentPage.value.mode === 'block' && editor.currentProject.value"
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
          编辑当前子页面的背景与主题
        </NTooltip>
        <NText depth="3" style="font-size: 12px; white-space: nowrap">
          容量 {{ editor.configBytesPercent.value }}%
        </NText>
        <NProgress
          type="line"
          :percentage="editor.configBytesPercent.value"
          :status="capacityStatus as any"
          :show-indicator="false"
          :height="6"
          style="width: 70px"
        />
      </NFlex>
    </template>
    <NFlex vertical size="small">
      <NCollapse
        v-if="editor.currentPage.value.mode !== 'legacy' && (editor.currentKey.value !== 'home' || editor.currentPage.value.mode !== 'block')"
        v-model:expanded-names="expandedPageSections"
      >
        <NCollapseItem
          v-if="editor.currentKey.value !== 'home'"
          class="page-info-section"
          title="页面基本设置"
          name="page-info"
        >
          <NForm label-placement="top" size="small">
            <PropsGrid>
              <NFormItem label="页面名称">
                <NInput v-model:value="editor.currentPage.value.title" placeholder="可选，用于管理列表展示" />
              </NFormItem>
              <NFormItem label="在导航菜单中显示">
                <NFlex justify="end">
                  <NSwitch v-model:value="editor.currentPage.value.navVisible" size="small" />
                </NFlex>
              </NFormItem>
              <NFormItem class="span-full" label="页面描述">
                <NInput
                  v-model:value="editor.currentPage.value.description"
                  type="textarea"
                  placeholder="可选"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </NFormItem>
              <NFormItem label="排序权重">
                <NInputNumber v-model:value="editor.currentPage.value.navOrder" style="width: 100%" placeholder="数字越小越靠前" />
              </NFormItem>
              <NFormItem label="路径 (Slug)">
                <NFlex :wrap="false" style="width: 100%">
                  <NInput v-model:value="pageSlug" placeholder="例如 links / sponsor / faq" @keyup.enter="renameCurrentPage" />
                  <NButton :disabled="pageSlug === editor.currentKey.value" @click="renameCurrentPage">
                    修改
                  </NButton>
                </NFlex>
              </NFormItem>
            </PropsGrid>
          </NForm>
        </NCollapseItem>

        <PageAppearanceOverrides />
      </NCollapse>

      <div style="background: var(--vtsuru-bg-inset); padding: 12px; border-radius: 8px">
        <NText depth="3" style="font-size: 12px; margin-bottom: 8px; display: block">
          页面渲染模式
        </NText>
        <NRadioGroup v-model:value="editor.currentPage.value.mode" size="small" style="width: 100%">
          <NRadioButton value="legacy" style="width: 33.3%; text-align: center">
            传统
          </NRadioButton>
          <NRadioButton value="block" style="width: 33.3%; text-align: center">
            区块
          </NRadioButton>
          <NRadioButton value="contrib" style="width: 33.4%; text-align: center">
            自定义
          </NRadioButton>
        </NRadioGroup>
      </div>

      <Transition name="fade-slide" mode="out-in">
        <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}`">
          <template v-if="editor.currentPage.value.mode === 'legacy'">
            <NDivider style="margin: 0" title-placement="left">
              主页设置
            </NDivider>
            <LegacyIndexSettings />
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'contrib'">
            <NForm label-placement="top" size="small">
              <PropsGrid>
                <NFormItem label="作用域">
                  <NSelect
                    v-model:value="editor.currentContrib.value!.scope"
                    :options="[{ label: '全局', value: 'global' }, { label: '主播专属', value: 'streamer' }]"
                  />
                </NFormItem>
                <NFormItem label="页面 ID">
                  <NAutoComplete
                    v-model:value="editor.currentContrib.value!.pageId"
                    :options="editor.contribPageIdOptions.value"
                    placeholder="选择或输入 pageId"
                    clearable
                  />
                </NFormItem>
                <NFormItem
                  v-if="editor.currentContrib.value!.scope === 'streamer'"
                  label="关联主播"
                >
                  <NInputNumber :value="editor.account.value.id" :disabled="true" style="width: 100%" />
                </NFormItem>
              </PropsGrid>
            </NForm>

            <NAlert v-if="editor.contribConfigError.value" type="error" :show-icon="true" style="margin-top: 12px">
              {{ editor.contribConfigError.value }}
            </NAlert>
            <NAlert v-else-if="editor.contribConfigLoading.value" type="info" :show-icon="true" style="margin-top: 12px">
              投稿页配置加载中...
            </NAlert>
            <template v-else-if="editor.contribConfigItems.value">
              <NFlex justify="space-between" align="center" style="margin-top: 12px">
                <NText strong>
                  页面配置
                </NText>
                <NButton size="small" secondary @click="editor.resetContribConfigToDefault">
                  重置为默认
                </NButton>
              </NFlex>
              <ErrorBoundary title="配置面板渲染失败">
                <ContribConfigEditor
                  :config="editor.contribConfigItems.value"
                  :config-data="(editor.currentContrib.value!.config as any)"
                />
              </ErrorBoundary>
            </template>
            <NAlert v-else type="warning" :show-icon="true" style="margin-top: 12px">
              该投稿页未导出 Config/DefaultConfig，可直接提交 PR 按约定补齐。
            </NAlert>
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'block' && editor.currentProject.value">
            <Transition name="fade-slide" mode="out-in">
              <div
                v-if="editor.selectedBlock.value"
                :key="`selected:${editor.selectedBlock.value.id}`"
                data-block-property-editor
                style="margin-top: 8px"
              >
                <NText strong style="display:block; margin-bottom: 6px">
                  属性编辑 - {{ editor.selectedBlock.value.type }}
                </NText>
                <ErrorBoundary title="区块属性面板渲染失败">
                  <BlockTypeEditor :block="editor.selectedBlock.value" />
                </ErrorBoundary>
              </div>
              <div v-else-if="editor.selectedBlocks.value.length > 1" key="multi" class="multi-selection-panel">
                <NText strong>
                  已选择 {{ editor.selectedBlocks.value.length }} 个区块
                </NText>
                <NFlex size="small">
                  <NButton size="small" secondary @click="batchSetHidden(false)">
                    显示
                  </NButton>
                  <NButton size="small" secondary @click="batchSetHidden(true)">
                    隐藏
                  </NButton>
                  <NButton size="small" secondary @click="batchSetChrome('framed', true)">
                    显示边框
                  </NButton>
                  <NButton size="small" secondary @click="batchSetChrome('framed', false)">
                    隐藏边框
                  </NButton>
                  <NButton size="small" secondary @click="batchSetChrome('backgrounded', true)">
                    显示背景
                  </NButton>
                  <NButton size="small" secondary @click="batchSetChrome('backgrounded', false)">
                    透明背景
                  </NButton>
                </NFlex>
                <NFlex size="small">
                  <NButton size="small" type="primary" secondary @click="groupSelection">
                    成组
                  </NButton>
                  <NButton size="small" secondary @click="duplicateSelection">
                    创建副本
                  </NButton>
                  <NButton size="small" secondary @click="editor.copyBlocksToClipboard(editor.selectedBlockIds.value)">
                    复制
                  </NButton>
                  <NButton size="small" type="error" secondary @click="editor.removeBlocks(editor.selectedBlockIds.value)">
                    删除
                  </NButton>
                </NFlex>
              </div>
              <div v-else key="empty" class="empty-selection-panel">
                <NText depth="3">
                  当前没有选中区块
                </NText>
                <NFlex size="small">
                  <NDropdown :options="addBlockOptions" trigger="click" @select="key => handleAddBlockMenuSelect(String(key))">
                    <NButton type="primary" secondary>
                      添加区块
                    </NButton>
                  </NDropdown>
                  <NDropdown :options="templateOptions" trigger="click" @select="key => insertTemplate(String(key))">
                    <NButton secondary>
                      起始模板
                    </NButton>
                  </NDropdown>
                </NFlex>
              </div>
            </Transition>
          </template>

          <template v-else>
            <NAlert type="warning" :show-icon="true">
              当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}，此处无可编辑项
            </NAlert>
          </template>
        </div>
      </Transition>

      <NButton block secondary @click="editor.openPreview">
        打开对外预览页
      </NButton>
    </NFlex>

    <input
      ref="uploadInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="editor.onUploadChange"
    >
  </NCard>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.multi-selection-panel,
.empty-selection-panel {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}
</style>
