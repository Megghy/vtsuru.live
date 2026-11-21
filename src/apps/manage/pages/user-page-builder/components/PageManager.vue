<script setup lang="ts">
import { Copy, LayoutGrid, MoreHorizontal, Plus, Trash2 } from 'lucide-vue-next'
import { computed, defineAsyncComponent, inject, nextTick, ref, watch } from 'vue'

import { resolveUserPageNavIcon } from '@/apps/user-page/pageIcons'
import type { UserPageConfig } from '@/apps/user-page/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { FormField } from '@/shared/ui/form-field'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { Separator } from '@/shared/ui/separator'

import { UserPageEditorKey } from '../context'
import { getAvailablePageModeOptions } from '../editorPageConfig'
import { usePageEntries } from '../usePageEntries'

const PageIconPickerModal = defineAsyncComponent(() => import('./PageIconPickerModal.vue'))

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const addPageModal = ref(false)
const newSlug = ref('')
const newMode = ref<UserPageConfig['mode']>('block')
const subpageModeOptions = computed(() => getAvailablePageModeOptions(false))

const duplicatePageModal = ref(false)
const duplicateFromSlug = ref('')
const duplicateToSlug = ref('')

const deletePageModal = ref(false)
const deletePageSlug = ref('')

const iconPickerShown = ref(false)
const hasOpenedIconPicker = ref(false)
watch(
  iconPickerShown,
  (val) => {
    if (val) hasOpenedIconPicker.value = true
  },
  { immediate: true },
)
const iconPickerSlug = ref('')
const iconPickerValue = computed(() =>
  iconPickerSlug.value ? editor.settings.value.pages?.[iconPickerSlug.value]?.navIcon : undefined,
)

const { pageEntries, visiblePages, hiddenPages } = usePageEntries(editor)
const pagesCount = computed(() => pageEntries.value.length)
const canCreateMorePages = computed(() => pagesCount.value < editor.MAX_PAGES_COUNT)
const pageSections = computed(() =>
  [
    { key: 'visible', label: '子页面 · 导航显示', pages: visiblePages.value, hidden: false },
    { key: 'hidden', label: '隐藏页面 · 仅可通过按钮跳转', pages: hiddenPages.value, hidden: true },
  ].filter((section) => section.pages.length),
)

function openDuplicatePage(slug: string) {
  duplicateFromSlug.value = slug
  duplicateToSlug.value = `${slug}-copy`
  duplicatePageModal.value = true
}

function handlePageAction(key: string, slug: string) {
  if (key === 'duplicate') openDuplicatePage(slug)
  else if (key === 'delete') {
    deletePageSlug.value = slug
    deletePageModal.value = true
  }
}

async function openIconPicker(slug: string) {
  iconPickerSlug.value = slug
  await nextTick()
  iconPickerShown.value = true
}

function setPageNavIcon(value: string | undefined) {
  const page = editor.settings.value.pages?.[iconPickerSlug.value]
  if (page) page.navIcon = value
}

function confirmDeletePage() {
  editor.removePage(deletePageSlug.value)
  deletePageModal.value = false
  deletePageSlug.value = ''
}

function createPage() {
  try {
    editor.createPage(newSlug.value, newMode.value)
    newSlug.value = ''
    newMode.value = 'block'
    addPageModal.value = false
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

function confirmDuplicatePage() {
  try {
    editor.duplicatePage(duplicateFromSlug.value, duplicateToSlug.value)
    duplicatePageModal.value = false
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="page-item">
      <div class="page-item__row flex items-center gap-1">
        <Button
          :variant="editor.currentKey.value === 'home' ? 'default' : 'outline'"
          class="page-item__main w-full justify-start"
          @click="editor.currentKey.value = 'home'"
        >
          <span class="truncate text-left w-full">主页 /@{{ editor.account.value.name || '...' }}</span>
        </Button>
      </div>
    </div>

    <Separator class="my-1" />

    <Button
      variant="outline"
      class="w-full gap-1.5"
      :disabled="!canCreateMorePages"
      @click="addPageModal = true"
    >
      <Plus class="size-3.5" />
      新建子页面
    </Button>

    <div class="flex flex-col gap-2">
      <template
        v-for="section in pageSections"
        :key="section.key"
      >
        <span class="text-[11px] font-medium text-muted-foreground mt-1">
          {{ section.label }}
        </span>
        <div
          v-for="p in section.pages"
          :key="p.slug"
          class="page-item"
          :class="{ 'opacity-90': section.hidden }"
        >
          <div class="page-item__row flex items-center gap-1">
            <Button
              :variant="editor.currentKey.value === p.slug ? 'default' : 'outline'"
              class="page-item__main flex-1 min-w-0 justify-start"
              @click="editor.currentKey.value = p.slug"
            >
              <div class="flex items-center w-full min-w-0 gap-1.5">
                <component
                  :is="resolveUserPageNavIcon(p.navIcon)"
                  class="size-3.5 shrink-0"
                />
                <span class="truncate text-left flex-1">{{ p.title }}</span>
              </div>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="更多页面操作"
                >
                  <MoreHorizontal class="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                class="min-w-32"
              >
                <DropdownMenuItem @click="openIconPicker(p.slug)">
                  <LayoutGrid class="size-3.5 mr-2" />
                  选择图标
                </DropdownMenuItem>
                <DropdownMenuItem @click="handlePageAction('duplicate', p.slug)">
                  <Copy class="size-3.5 mr-2" />
                  复制
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  @click="handlePageAction('delete', p.slug)"
                >
                  <Trash2 class="size-3.5 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </template>
    </div>

    <!-- 新建页面弹窗 -->
    <Dialog v-model:open="addPageModal">
      <DialogContent class="max-w-md p-4">
        <DialogHeader>
          <DialogTitle class="text-sm">新建子页面</DialogTitle>
          <DialogDescription class="sr-only">输入页面链接标识并选择搭建模式以创建新的公开子页面。</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3 py-2">
          <FormField
            v-model="newSlug"
            type="text"
            label="页面链接标识 (Slug)"
            required
            placeholder="例如 links / sponsor / faq（仅限字母、数字、短横线）"
          />

          <FormField label="搭建模式">
            <RadioGroup
              v-model="newMode"
              class="flex flex-col gap-2"
            >
              <label
                v-for="opt in subpageModeOptions"
                :key="opt.value"
                class="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors"
                :class="
                  newMode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                "
              >
                <RadioGroupItem
                  :value="opt.value"
                  class="mt-0.5"
                />
                <div class="flex-1 text-xs">
                  <div class="flex items-center gap-1.5 font-medium">
                    {{ opt.label }}
                    <Badge
                      v-if="opt.tag"
                      variant="secondary"
                      size="xs"
                    >
                      {{ opt.tag }}
                    </Badge>
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                    {{ opt.description }}
                  </div>
                </div>
              </label>
            </RadioGroup>
          </FormField>

          <Alert class="bg-primary/5 border-primary/20">
            <AlertDescription>
              创建后访问地址：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="addPageModal = false"
          >
            取消
          </Button>
          <Button
            :disabled="!newSlug.trim().length"
            @click="createPage"
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 复制子页面弹窗 -->
    <Dialog v-model:open="duplicatePageModal">
      <DialogContent class="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle class="text-sm">复制子页面</DialogTitle>
          <DialogDescription class="sr-only">输入新的页面标识，基于所选子页面创建一份独立副本。</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3 py-2">
          <Alert class="bg-primary/5 border-primary/20">
            <AlertDescription>复制自：/{{ duplicateFromSlug || 'slug' }}</AlertDescription>
          </Alert>
          <FormField
            v-model="duplicateToSlug"
            type="text"
            label="新页面标识 (Slug)"
            description="会自动为复制后的页面生成新的区块 ID，避免与原页面冲突。"
            required
            placeholder="例如 links-copy"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="duplicatePageModal = false"
          >
            取消
          </Button>
          <Button
            :disabled="!duplicateToSlug.trim().length"
            @click="confirmDuplicatePage"
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除确认弹窗 -->
    <AlertDialog v-model:open="deletePageModal">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除子页面</AlertDialogTitle>
          <AlertDialogDescription>
            将删除 /{{ deletePageSlug }} 及其中全部配置，此操作可通过撤销恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDeletePage"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <PageIconPickerModal
      v-if="hasOpenedIconPicker || iconPickerShown"
      v-model:show="iconPickerShown"
      :value="iconPickerValue"
      @select="setPageNavIcon"
    />
  </div>
</template>

<style scoped src="./ui-transitions.css"></style>
