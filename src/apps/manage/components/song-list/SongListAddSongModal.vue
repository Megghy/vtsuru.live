<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { ResponseSongModel } from '@/api/generated/model'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import SongListAddSongModalCustomTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalCustomTab.vue'
import SongListAddSongModalDirectoryTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalDirectoryTab.vue'
import SongListAddSongModalFileTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFileTab.vue'
import SongListAddSongModalFivesingTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFivesingTab.vue'
import SongListAddSongModalNeteaseTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalNeteaseTab.vue'
import SongListAddSongModalTextTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalTextTab.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const props = defineProps<{
  show: boolean
  songs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'added', songs: ResponseSongModel[]): void
}>()

const route = useRoute()
const assistant = useAssistantStore()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const modalRenderKey = ref(0)
const isModalLoading = ref(false)

const activeTab = ref('custom')

type FooterTabRef =
  | InstanceType<typeof SongListAddSongModalTextTab>
  | InstanceType<typeof SongListAddSongModalNeteaseTab>
  | InstanceType<typeof SongListAddSongModalFileTab>
  | InstanceType<typeof SongListAddSongModalDirectoryTab>

const customTabRef = ref<InstanceType<typeof SongListAddSongModalCustomTab>>()
const textTabRef = ref<InstanceType<typeof SongListAddSongModalTextTab>>()
const neteaseTabRef = ref<InstanceType<typeof SongListAddSongModalNeteaseTab>>()
const fileTabRef = ref<InstanceType<typeof SongListAddSongModalFileTab>>()
const directoryTabRef = ref<InstanceType<typeof SongListAddSongModalDirectoryTab>>()

const footerConfig = computed<{ hint: string; tab: FooterTabRef | null }>(() => {
  switch (activeTab.value) {
    case 'custom':
      return { hint: '填写上方表单后点击添加', tab: null }
    case 'text':
      return { hint: '粘贴文本后在右侧勾选待添加曲目', tab: textTabRef.value ?? null }
    case 'netease':
      return { hint: '选择歌曲后添加到歌单', tab: neteaseTabRef.value ?? null }
    case 'file':
      return { hint: '解析文件后在右侧勾选歌曲', tab: fileTabRef.value ?? null }
    case 'directory':
      return { hint: '扫描文件夹后在右侧勾选歌曲', tab: directoryTabRef.value ?? null }
    default:
      return { hint: '在搜索结果表格中点击"添加"按钮将单曲加入歌单', tab: null }
  }
})

const songSelectOption = [
  { label: '中文', value: '中文' },
  { label: '日语', value: '日语' },
  { label: '英语', value: '英语' },
  { label: '韩语', value: '韩语' },
  { label: '法语', value: '法语' },
  { label: '西语', value: '西语' },
  { label: '其他', value: '其他' },
]

const authors = computed(() => {
  const items = new Set<string>()
  props.songs.forEach((s) => {
    s?.author?.forEach((a) => items.add(a))
  })
  return [...items].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
})

const tags = computed(() => {
  const items = new Set<string>()
  props.songs.forEach((s) => {
    s?.tags?.forEach((t) => items.add(t))
  })
  return [...items].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
})

const languageSelectOption = computed(() => {
  const items = new Set<string>(songSelectOption.map((s) => s.label))
  props.songs.forEach((s) => {
    s?.language?.forEach((l) => items.add(l))
  })
  return [...items].toSorted((a, b) => a.localeCompare(b, 'zh-CN')).map((t) => ({ label: t, value: t }))
})

function onAdded(songs: ResponseSongModel[]) {
  emit('added', songs)
}

function onLoadingChange(value: boolean) {
  isModalLoading.value = value
}

function bumpRenderKey() {
  modalRenderKey.value++
}

function openAssistant() {
  showModel.value = false
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '歌单管理',
    path: route.path,
  })
}
</script>

<template>
  <Dialog v-model:open="showModel">
    <DialogContent
      :key="modalRenderKey"
      class="max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden"
    >
      <DialogHeader class="px-4 py-3.5 border-b shrink-0">
        <DialogTitle class="text-sm">添加歌曲</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto p-4">
        <Spin :show="isModalLoading">
          <div class="space-y-3">
            <Alert
              size="sm"
              variant="info"
            >
              <div class="flex-between flex-wrap gap-2 w-full">
                <div class="space-y-0.5">
                  <AlertTitle>也可以使用 VTsuru 助手</AlertTitle>
                  <AlertDescription>
                    上传歌曲信息截图，或直接粘贴歌曲信息，Agent 会自动识别并生成添加操作。
                  </AlertDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1 shrink-0"
                  @click="openAssistant"
                >
                  <Bot class="size-3.5" />
                  打开助手
                </Button>
              </div>
            </Alert>

            <Tabs
              v-model="activeTab"
              class="w-full"
            >
              <TabsList class="flex-wrap h-auto">
                <TabsTrigger value="custom">手动录入</TabsTrigger>
                <TabsTrigger value="text">文本批量粘贴</TabsTrigger>
                <TabsTrigger value="netease">网易云歌单</TabsTrigger>
                <TabsTrigger value="5sing">5sing 搜索</TabsTrigger>
                <TabsTrigger value="file">表格/CSV 导入</TabsTrigger>
                <TabsTrigger value="directory">文件夹扫描</TabsTrigger>
              </TabsList>

              <TabsContent
                value="custom"
                class="pt-3"
              >
                <SongListAddSongModalCustomTab
                  ref="customTabRef"
                  :existing-songs="songs"
                  :authors="authors"
                  :tags="tags"
                  :song-select-option="languageSelectOption"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                  @reset-render="bumpRenderKey"
                />
              </TabsContent>

              <TabsContent
                value="text"
                class="pt-3"
              >
                <SongListAddSongModalTextTab
                  ref="textTabRef"
                  :existing-songs="songs"
                  :tags="tags"
                  :language-options="languageSelectOption"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                />
              </TabsContent>

              <TabsContent
                value="netease"
                class="pt-3"
              >
                <SongListAddSongModalNeteaseTab
                  ref="neteaseTabRef"
                  :existing-songs="songs"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                />
              </TabsContent>

              <TabsContent
                value="5sing"
                class="pt-3"
              >
                <SongListAddSongModalFivesingTab
                  :existing-songs="songs"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                />
              </TabsContent>

              <TabsContent
                value="file"
                class="pt-3"
              >
                <SongListAddSongModalFileTab
                  ref="fileTabRef"
                  :existing-songs="songs"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                />
              </TabsContent>

              <TabsContent
                value="directory"
                class="pt-3"
              >
                <SongListAddSongModalDirectoryTab
                  ref="directoryTabRef"
                  :existing-songs="songs"
                  :authors="authors"
                  :tags="tags"
                  :language-select-option="languageSelectOption"
                  @added="onAdded"
                  @loading-change="onLoadingChange"
                />
              </TabsContent>
            </Tabs>
          </div>
        </Spin>
      </div>

      <DialogFooter class="px-4 py-3 border-t bg-muted/10 flex-between shrink-0">
        <span class="text-xs text-muted-foreground">{{ footerConfig.hint }}</span>
        <div
          v-if="activeTab === 'custom' && customTabRef"
          class="flex items-center gap-2"
        >
          <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
            <Checkbox v-model:checked="customTabRef.onlyResetNameOnAdded" />
            <span class="text-muted-foreground">添加完成仅重置歌名</span>
          </label>
          <Button
            size="xs"
            variant="outline"
            @click="customTabRef.resetAll()"
          >
            还原
          </Button>
          <Button
            :disabled="!customTabRef.canAdd || isModalLoading"
            @click="customTabRef.add()"
          >
            添加歌曲
          </Button>
        </div>
        <Button
          v-else-if="footerConfig.tab"
          :disabled="!footerConfig.tab.canAdd || isModalLoading"
          @click="footerConfig.tab.add()"
        >
          {{ footerConfig.tab.label }}
        </Button>
        <Button
          v-else
          disabled
        >
          在表格中点击添加
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
