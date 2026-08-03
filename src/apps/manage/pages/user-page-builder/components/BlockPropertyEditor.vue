<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'

import { UserPageEditorKey } from '../context'
import BlockTypeEditor from './BlockTypeEditor.vue'
import ErrorBoundary from './ErrorBoundary.vue'
import LegacyIndexSettings from './LegacyIndexSettings.vue'
import PageAppearanceOverrides from './PageAppearanceOverrides.vue'
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

watch(editor.currentKey, (key) => (pageSlug.value = key))

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
  <UCard
    class="block-property-editor"
    title="编辑"
    style="width: 100%; height: 100%"
    content-style="padding: 12px"
  >
    <template #header-extra>
      <div
        class="builder-row"
        style="gap: 6px; min-width: 0"
      >
        <UTooltip
          v-if="
            editor.currentKey.value !== 'home' &&
            editor.currentPage.value.mode === 'block' &&
            editor.currentProject.value
          "
        >
          <UButton
            color="primary"
            variant="soft"
            size="xs"
            aria-label="编辑当前页面主题"
            @click="editor.pageThemeModal.value = true"
          >
            <template #icon>
              <UIcon name="i-lucide-palette" />
            </template>
            页面主题
          </UButton>
          <template #content> 编辑当前子页面的背景与主题 </template></UTooltip
        >
        <span
          class="builder-text"
          style="font-size: 12px; white-space: nowrap"
        >
          容量 {{ editor.configBytesPercent.value }}%
        </span>
        <UProgress
          type="line"
          :percentage="editor.configBytesPercent.value"
          :status="capacityStatus as any"
          :show-indicator="false"
          :height="6"
          style="width: 70px"
        />
      </div>
    </template>
    <div class="builder-stack">
      <div
        v-if="
          editor.currentPage.value.mode !== 'legacy' &&
          (editor.currentKey.value !== 'home' || editor.currentPage.value.mode !== 'block')
        "
      >
        <details
          v-if="editor.currentKey.value !== 'home'"
          class="page-info-section"
        >
          <summary>页面基本设置</summary>
          <div class="builder-form">
            <PropsGrid>
              <UFormField label="页面名称">
                <UInput
                  v-model="editor.currentPage.value.title"
                  placeholder="可选，用于管理列表展示"
                />
              </UFormField>
              <UFormField label="在导航菜单中显示">
                <div class="builder-row">
                  <USwitch
                    v-model="editor.currentPage.value.navVisible"
                    size="small"
                  />
                </div>
              </UFormField>
              <UFormField
                class="span-full"
                label="页面描述"
              >
                <UTextarea
                  v-model="editor.currentPage.value.description"
                  placeholder="可选"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </UFormField>
              <UFormField label="排序权重">
                <UInputNumber
                  v-model="editor.currentPage.value.navOrder"
                  style="width: 100%"
                  placeholder="数字越小越靠前"
                />
              </UFormField>
              <UFormField label="路径 (Slug)">
                <div
                  class="builder-row"
                  style="width: 100%"
                >
                  <UInput
                    v-model="pageSlug"
                    placeholder="例如 links / sponsor / faq"
                    @keyup.enter="renameCurrentPage"
                  />
                  <UButton
                    :disabled="pageSlug === editor.currentKey.value"
                    @click="renameCurrentPage"
                  >
                    修改
                  </UButton>
                </div>
              </UFormField>
            </PropsGrid>
          </div>
        </details>

        <PageAppearanceOverrides />
      </div>

      <div style="background: var(--vtsuru-bg-inset); padding: 12px; border-radius: 8px">
        <span
          class="builder-text"
          style="font-size: 12px; margin-bottom: 8px; display: block"
        >
          页面渲染模式
        </span>
        <URadioGroup
          v-model="editor.currentPage.value.mode"
          :items="[
            { label: '传统', value: 'legacy' },
            { label: '区块', value: 'block' },
            { label: '自定义', value: 'contrib' },
          ]"
          orientation="horizontal"
        />
      </div>

      <Transition
        name="fade-slide"
        mode="out-in"
      >
        <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}`">
          <template v-if="editor.currentPage.value.mode === 'legacy'">
            <USeparator
              style="margin: 0"
              title-placement="left"
            >
              主页设置
            </USeparator>
            <LegacyIndexSettings />
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'contrib'">
            <div class="builder-form">
              <PropsGrid>
                <UFormField label="作用域">
                  <USelect
                    v-model="editor.currentContrib.value!.scope"
                    :items="[
                      { label: '全局', value: 'global' },
                      { label: '主播专属', value: 'streamer' },
                    ]"
                  />
                </UFormField>
                <UFormField label="页面 ID">
                  <UInputMenu
                    v-model="editor.currentContrib.value!.pageId"
                    :items="editor.contribPageIdOptions.value"
                    value-key="value"
                    placeholder="选择或输入 pageId"
                    clearable
                  />
                </UFormField>
                <UFormField
                  v-if="editor.currentContrib.value!.scope === 'streamer'"
                  label="关联主播"
                >
                  <UInputNumber
                    :value="editor.account.value.id"
                    :disabled="true"
                    style="width: 100%"
                  />
                </UFormField>
              </PropsGrid>
            </div>

            <UAlert
              v-if="editor.contribConfigError.value"
              type="error"
              :show-icon="true"
              style="margin-top: 12px"
            >
              {{ editor.contribConfigError.value }}
            </UAlert>
            <UAlert
              v-else-if="editor.contribConfigLoading.value"
              type="info"
              :show-icon="true"
              style="margin-top: 12px"
            >
              投稿页配置加载中...
            </UAlert>
            <template v-else-if="editor.contribConfigItems.value">
              <div
                class="builder-row"
                style="margin-top: 12px"
              >
                <span class="builder-text"> 页面配置 </span>
                <UButton
                  size="sm"
                  variant="soft"
                  @click="editor.resetContribConfigToDefault"
                >
                  重置为默认
                </UButton>
              </div>
              <ErrorBoundary title="配置面板渲染失败">
                <ContribConfigEditor
                  :config="editor.contribConfigItems.value"
                  :config-data="editor.currentContrib.value!.config as any"
                />
              </ErrorBoundary>
            </template>
            <UAlert
              v-else
              type="warning"
              :show-icon="true"
              style="margin-top: 12px"
            >
              该投稿页未导出 Config/DefaultConfig，可直接提交 PR 按约定补齐。
            </UAlert>
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'block' && editor.currentProject.value">
            <Transition
              name="fade-slide"
              mode="out-in"
            >
              <div
                v-if="editor.selectedBlock.value"
                :key="`selected:${editor.selectedBlock.value.id}`"
                data-block-property-editor
                style="margin-top: 8px"
              >
                <span
                  class="builder-text"
                  style="display: block; margin-bottom: 6px"
                >
                  属性编辑 - {{ editor.selectedBlock.value.type }}
                </span>
                <ErrorBoundary title="区块属性面板渲染失败">
                  <BlockTypeEditor :block="editor.selectedBlock.value" />
                </ErrorBoundary>
              </div>
              <div
                v-else-if="editor.selectedBlocks.value.length > 1"
                key="multi"
                class="multi-selection-panel"
              >
                <span class="builder-text"> 已选择 {{ editor.selectedBlocks.value.length }} 个区块 </span>
                <div class="builder-row">
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetHidden(false)"
                  >
                    显示
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetHidden(true)"
                  >
                    隐藏
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetChrome('framed', true)"
                  >
                    显示边框
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetChrome('framed', false)"
                  >
                    隐藏边框
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetChrome('backgrounded', true)"
                  >
                    显示背景
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="batchSetChrome('backgrounded', false)"
                  >
                    透明背景
                  </UButton>
                </div>
                <div class="builder-row">
                  <UButton
                    size="sm"
                    color="primary"
                    variant="soft"
                    @click="groupSelection"
                  >
                    成组
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="duplicateSelection"
                  >
                    创建副本
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    @click="editor.copyBlocksToClipboard(editor.selectedBlockIds.value)"
                  >
                    复制
                  </UButton>
                  <UButton
                    size="sm"
                    color="error"
                    variant="soft"
                    @click="editor.removeBlocks(editor.selectedBlockIds.value)"
                  >
                    删除
                  </UButton>
                </div>
              </div>
              <div
                v-else
                key="empty"
                class="empty-selection-panel"
              >
                <span class="builder-text"> 当前没有选中区块 </span>
                <div class="builder-row">
                  <UDropdownMenu :items="addBlockOptions">
                    <UButton
                      color="primary"
                      variant="soft"
                    >
                      添加区块
                    </UButton>
                  </UDropdownMenu>
                  <UDropdownMenu :items="templateOptions">
                    <UButton variant="soft"> 起始模板 </UButton>
                  </UDropdownMenu>
                </div>
              </div>
            </Transition>
          </template>

          <template v-else>
            <UAlert
              type="warning"
              :show-icon="true"
            >
              当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}，此处无可编辑项
            </UAlert>
          </template>
        </div>
      </Transition>

      <UButton
        block
        variant="soft"
        @click="editor.openPreview"
      >
        打开对外预览页
      </UButton>
    </div>

    <input
      ref="uploadInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="editor.onUploadChange"
    />
  </UCard>
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
