<script setup lang="ts">
import { CopyOutline, EllipsisHorizontalOutline, TrashOutline } from '@vicons/ionicons5'
import { computed, inject, ref } from 'vue'

import type { UserPageConfig } from '@/apps/user-page/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { Tag } from '@/shared/ui/tag'

import { UserPageEditorKey } from '../context'
import { getPageModeShortLabel, PAGE_MODE_OPTIONS } from '../editorPageConfig'
import { usePageEntries } from '../usePageEntries'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const addPageModal = ref(false)
const newSlug = ref('')
const newMode = ref<UserPageConfig['mode']>('block')

const duplicatePageModal = ref(false)
const duplicateFromSlug = ref('')
const duplicateToSlug = ref('')

const deletePageModal = ref(false)
const deletePageSlug = ref('')

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
          class="page-item__main w-full justify-start px-2"
          @click="editor.currentKey.value = 'home'"
        >
          <div class="page-item__btn-content flex items-center justify-between w-full min-w-0 gap-1">
            <span class="truncate text-left flex-1"> 主页 /@{{ editor.account.value.name || '...' }} </span>
            <Tag
              variant="outline"
              class="text-[10px] h-4.5 px-1 shrink-0"
            >
              {{ getPageModeShortLabel(editor.settings.value.home?.mode ?? 'block') }}
            </Tag>
          </div>
        </Button>
      </div>
    </div>

    <div class="h-px bg-border my-1" />

    <Button
      variant="outline"
      class="w-full"
      :disabled="!canCreateMorePages"
      @click="addPageModal = true"
    >
      新建子页面
    </Button>

    <div class="flex flex-col gap-2">
      <template
        v-for="section in pageSections"
        :key="section.key"
      >
        <span class="text-xs text-muted-foreground mt-1">
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
              class="page-item__main flex-1 min-w-0 justify-start px-2"
              @click="editor.currentKey.value = p.slug"
            >
              <div class="page-item__btn-content flex items-center justify-between w-full min-w-0 gap-1">
                <span class="truncate text-left flex-1">
                  {{ p.title }}
                </span>
                <Tag
                  variant="outline"
                  class="text-[10px] h-4.5 px-1 shrink-0"
                >
                  {{ getPageModeShortLabel(p.mode ?? 'block') }}
                </Tag>
              </div>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  class="size-7 p-0"
                  aria-label="更多页面操作"
                >
                  <component
                    :is="EllipsisHorizontalOutline"
                    class="size-3.5"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                class="w-28 text-xs"
              >
                <DropdownMenuItem @click="handlePageAction('duplicate', p.slug)">
                  <component
                    :is="CopyOutline"
                    class="size-3.5 mr-2"
                  />
                  复制
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  @click="handlePageAction('delete', p.slug)"
                >
                  <component
                    :is="TrashOutline"
                    class="size-3.5 mr-2"
                  />
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
          <DialogTitle class="text-sm font-semibold">新建子页面</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-3 py-2">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium">页面链接标识 (Slug) <span class="text-destructive">*</span></label>
            <Input
              v-model="newSlug"
              placeholder="例如 links / sponsor / faq（仅限字母、数字、短横线）"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium">搭建模式</label>
            <RadioGroup
              v-model="newMode"
              class="flex flex-col gap-2"
            >
              <label
                v-for="opt in PAGE_MODE_OPTIONS"
                :key="opt.value"
                class="flex items-start gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50"
              >
                <RadioGroupItem
                  :value="opt.value"
                  class="mt-0.5"
                />
                <div class="flex-1 text-xs">
                  <div class="flex items-center gap-1.5 font-medium">
                    {{ opt.label }}
                    <Tag
                      v-if="opt.tag"
                      variant="secondary"
                      class="text-[10px] h-4 px-1"
                    >
                      {{ opt.tag }}
                    </Tag>
                  </div>
                  <div class="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                    {{ opt.description }}
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <Alert class="bg-primary/5 border-primary/20 text-xs py-2">
            <AlertDescription>
              创建后访问地址：/@{{ editor.account.value.name || 'name' }}/{{ newSlug || 'slug' }}
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="addPageModal = false"
            >取消</Button
          >
          <Button
            :disabled="!newSlug.trim().length"
            @click="createPage"
            >创建</Button
          >
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 复制子页面弹窗 -->
    <Dialog v-model:open="duplicatePageModal">
      <DialogContent class="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">复制子页面</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-3 py-2">
          <Alert class="bg-primary/5 border-primary/20 text-xs py-2">
            <AlertDescription>复制自：/{{ duplicateFromSlug || 'slug' }}</AlertDescription>
          </Alert>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium">新页面标识 (Slug) <span class="text-destructive">*</span></label>
            <Input
              v-model="duplicateToSlug"
              placeholder="例如 links-copy"
            />
          </div>
          <span class="text-[11px] text-muted-foreground">会自动为复制后的页面生成新的区块 ID，避免与原页面冲突。</span>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="duplicatePageModal = false"
            >取消</Button
          >
          <Button
            :disabled="!duplicateToSlug.trim().length"
            @click="confirmDuplicatePage"
            >确定</Button
          >
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除确认弹窗 -->
    <Dialog v-model:open="deletePageModal">
      <DialogContent class="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold text-destructive">删除子页面</DialogTitle>
        </DialogHeader>
        <div class="py-2 text-xs text-muted-foreground">
          将删除 /{{ deletePageSlug }} 及其中全部配置，此操作可通过撤销恢复。
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="deletePageModal = false"
            >取消</Button
          >
          <Button
            variant="destructive"
            @click="confirmDeletePage"
            >删除</Button
          >
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped src="./ui-transitions.css"></style>
