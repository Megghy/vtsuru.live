<script setup lang="ts">
import { Delete24Regular } from '@vicons/fluent'
import { ArrowDownOutline, ArrowUpOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import { SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import type { ResponseUserIndexModel, VideoData } from '@/api/generated/model'
import {
  getApiUserIndexGet,
  postApiUserIndexAddVideo,
  postApiUserIndexDeleteVideo,
  postApiUserIndexUpdateSetting,
} from '@/api/generated/user-index/user-index'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { IndexTemplateMap } from '@/shared/config/templates'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

const accountInfo = useAccount()
const message = useMessage()

const selectedIndexTemplateKey = computed({
  get: () => accountInfo.value.settings.indexTemplate || 'default',
  set: (val: string) => {
    accountInfo.value.settings.indexTemplate = val
  },
})

const selectedIndexTemplate = computed(
  () => IndexTemplateMap[selectedIndexTemplateKey.value] || IndexTemplateMap.default,
)
const indexTemplateOptions = Object.entries(IndexTemplateMap).map(([key, item]) => ({
  label: item.name,
  value: key,
}))
const showTemplatePreview = ref(false)

const showAddVideoModal = ref(false)
const addVideoUrl = ref('')

const showAddLinkModal = ref(false)
const addLinkName = ref('')
const addLinkUrl = ref('')

const linkKey = ref(0)
const editingLinkName = ref<string | null>(null)
const newLinkName = ref('')

const isLoading = ref(false)
const indexDisplayInfo = ref<ResponseUserIndexModel | null>(null)

async function loadIndexInfo() {
  if (!accountInfo.value?.name) return
  isLoading.value = true
  try {
    const data = (await getApiUserIndexGet({
      id: accountInfo.value.name,
    })) as unknown as {
      code: number
      message?: string
      data: ResponseUserIndexModel
    }
    if (data.code === 200) {
      indexDisplayInfo.value = data.data
      return
    }
    if (data.code === 404) {
      indexDisplayInfo.value = { notification: '', links: {}, videos: [] }
      return
    }
    throw new Error(data.message || `无法获取数据: ${data.code}`)
  } catch (e) {
    console.error('Failed to load user index info:', e)
    message.error(`无法获取数据: ${(e as Error).message || String(e)}`)
    indexDisplayInfo.value = null
  } finally {
    isLoading.value = false
  }
}

async function updateUserIndexSettings() {
  try {
    await SaveSetting('Index', accountInfo.value.settings.index)
    message.success('已保存')
  } catch (e) {
    message.error(`保存失败: ${(e as Error).message || String(e)}`)
  }
}

async function updateIndexSettings() {
  isLoading.value = true
  try {
    const response = await postApiUserIndexUpdateSetting(accountInfo.value.settings.index)
    if (response.code !== 200) throw new Error(response.message || `保存失败: ${response.code}`)
    message.success('已保存')
  } catch (err) {
    message.error(`保存失败: ${(err as Error).message || String(err)}`)
  } finally {
    isLoading.value = false
  }
}

async function saveIndexTemplate(templateKey: string) {
  accountInfo.value.settings.indexTemplate = templateKey
  try {
    const response = await SaveAccountSettings()
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success('已切换主页模板')
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

async function addVideo() {
  if (!addVideoUrl.value) {
    message.error('请输入视频链接')
    return
  }
  isLoading.value = true
  try {
    const response = (await postApiUserIndexAddVideo({
      video: addVideoUrl.value,
    })) as unknown as {
      code: number
      message?: string
      data: VideoData
    }
    if (response.code !== 200) throw new Error(response.message || `保存失败: ${response.code}`)
    message.success('添加成功')
    if (indexDisplayInfo.value) {
      indexDisplayInfo.value.videos.push(response.data)
    }
    accountInfo.value.settings.index.videos.push(response.data.id)
    showAddVideoModal.value = false
    addVideoUrl.value = ''
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function removeVideo(id: string) {
  isLoading.value = true
  try {
    const response = (await postApiUserIndexDeleteVideo({
      video: id,
    })) as unknown as {
      code: number
      message?: string
      data: VideoData
    }
    if (response.code !== 200) throw new Error(response.message || `删除失败: ${response.code}`)
    message.success('删除成功')
    if (indexDisplayInfo.value) {
      indexDisplayInfo.value.videos = indexDisplayInfo.value.videos.filter((v) => v.id !== id)
    }
    accountInfo.value.settings.index.videos = accountInfo.value.settings.index.videos.filter((v) => v !== id)
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function moveVideo(id: string, direction: 'up' | 'down') {
  const videos = accountInfo.value.settings.index.videos
  const currentIndex = videos.indexOf(id)
  if (currentIndex === -1) return
  if (direction === 'up' && currentIndex > 0) {
    ;[videos[currentIndex], videos[currentIndex - 1]] = [videos[currentIndex - 1], videos[currentIndex]]
  } else if (direction === 'down' && currentIndex < videos.length - 1) {
    ;[videos[currentIndex], videos[currentIndex + 1]] = [videos[currentIndex + 1], videos[currentIndex]]
  } else {
    return
  }
  isLoading.value = true
  try {
    await updateIndexSettings()
    await loadIndexInfo()
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function addLink() {
  if (!addLinkName.value || !addLinkUrl.value) {
    message.error('请输入链接名称和地址')
    return
  }
  try {
    const validatedUrl = new URL(addLinkUrl.value)
    addLinkUrl.value = validatedUrl.toString()
  } catch {
    message.error('请输入正确的链接')
    return
  }
  if (!accountInfo.value.settings.index.links) {
    accountInfo.value.settings.index.links = {}
  }
  if (accountInfo.value.settings.index.links[addLinkName.value]) {
    message.error('链接名称已存在')
    return
  }
  accountInfo.value.settings.index.links[addLinkName.value] = addLinkUrl.value
  if (!accountInfo.value.settings.index.linkOrder) {
    accountInfo.value.settings.index.linkOrder = []
  }
  accountInfo.value.settings.index.linkOrder.push(addLinkName.value)
  try {
    await updateIndexSettings()
    await loadIndexInfo()
    message.success('添加成功')
    showAddLinkModal.value = false
    addLinkName.value = ''
    addLinkUrl.value = ''
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

async function removeLink(name: string) {
  delete accountInfo.value.settings.index.links[name]
  accountInfo.value.settings.index.linkOrder = (accountInfo.value.settings.index.linkOrder || []).filter(
    (item) => item !== name,
  )
  try {
    await updateIndexSettings()
    await loadIndexInfo()
    message.success('删除成功')
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

function startEditLink(name: string) {
  editingLinkName.value = name
  newLinkName.value = name
}

function cancelEditLink() {
  editingLinkName.value = null
  newLinkName.value = ''
}

async function confirmEditLink(oldName: string) {
  if (!newLinkName.value || newLinkName.value === oldName) {
    cancelEditLink()
    return
  }
  const links = accountInfo.value.settings.index.links || {}
  const linkOrder = accountInfo.value.settings.index.linkOrder || []
  if (links[newLinkName.value]) {
    message.error('新链接名称已存在')
    return
  }
  links[newLinkName.value] = links[oldName]
  delete links[oldName]
  const index = linkOrder.indexOf(oldName)
  if (index !== -1) {
    linkOrder[index] = newLinkName.value
  }
  try {
    await updateIndexSettings()
    message.success('改名成功')
    cancelEditLink()
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

async function moveLink(name: string, direction: 'up' | 'down') {
  const linkOrder = accountInfo.value.settings.index.linkOrder || []
  const currentIndex = linkOrder.indexOf(name)
  if (currentIndex === -1) return
  if (direction === 'up' && currentIndex > 0) {
    ;[linkOrder[currentIndex], linkOrder[currentIndex - 1]] = [linkOrder[currentIndex - 1], linkOrder[currentIndex]]
  } else if (direction === 'down' && currentIndex < linkOrder.length - 1) {
    ;[linkOrder[currentIndex], linkOrder[currentIndex + 1]] = [linkOrder[currentIndex + 1], linkOrder[currentIndex]]
  } else {
    return
  }
  accountInfo.value.settings.index.linkOrder = linkOrder
  try {
    await updateIndexSettings()
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

const orderedLinks = computed<[string, string][]>(() => {
  const links = indexDisplayInfo.value?.links || {}
  const order = accountInfo.value.settings.index.linkOrder || []
  const ordered: [string, string][] = []
  order.forEach((key) => {
    if (links[key]) {
      ordered.push([key, links[key]])
    }
  })
  Object.entries(links).forEach(([key, value]) => {
    if (!order.includes(key)) {
      ordered.push([key, value])
    }
  })
  return ordered
})

accountInfo.value.settings.index ??= {
  allowDisplayInIndex: true,
  videos: [],
  notification: '',
  links: {},
  linkOrder: [],
}
accountInfo.value.settings.index.videos ??= []
accountInfo.value.settings.index.links ??= {}
if (!accountInfo.value.settings.index.linkOrder || accountInfo.value.settings.index.linkOrder.length === 0) {
  accountInfo.value.settings.index.linkOrder = Object.keys(accountInfo.value.settings.index.links || {})
}
await loadIndexInfo()
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 主页模板 -->
    <div class="flex flex-col gap-2">
      <div class="text-xs font-semibold text-muted-foreground uppercase">主页模板</div>
      <div class="flex flex-col gap-2.5 p-3 border border-border rounded-lg bg-muted">
        <div class="flex min-w-0 flex-col gap-1">
          <div class="text-foreground text-sm font-semibold">
            {{ selectedIndexTemplate.name }}
          </div>
          <div class="text-muted-foreground text-xs leading-normal">支持头图、头像框、荣誉、直播状态和精选内容。</div>
        </div>
        <div class="flex items-center gap-2 w-full">
          <Select
            v-model="selectedIndexTemplateKey"
            class="flex-1 min-w-0"
            @update:model-value="saveIndexTemplate"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem
                v-for="opt in indexTemplateOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            @click="showTemplatePreview = true"
          >
            浏览预览
          </Button>
        </div>
      </div>
    </div>

    <!-- 常规 -->
    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="text-xs font-semibold text-muted-foreground uppercase">常规</div>
      <label class="flex items-center gap-2 text-xs cursor-pointer select-none">
        <Checkbox
          :checked="accountInfo.settings.index.allowDisplayInIndex"
          :disabled="isLoading"
          @update:checked="((accountInfo.settings.index.allowDisplayInIndex = $event), updateUserIndexSettings())"
        />
        允许显示在网站主页与直播列表
      </label>
    </div>

    <!-- 通知 -->
    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="text-xs font-semibold text-muted-foreground uppercase">通知</div>
      <Textarea
        v-model="accountInfo.settings.index.notification"
        placeholder="可选，向访问你主页的访客展示的置顶通知"
        class="text-xs"
        rows="3"
      />
      <div class="flex justify-end">
        <Button
          :disabled="isLoading"
          @click="updateIndexSettings"
        >
          保存
        </Button>
      </div>
    </div>

    <!-- 展示视频 -->
    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="flex items-center justify-between">
        <div class="text-xs font-semibold text-muted-foreground uppercase">展示视频</div>
        <Button
          variant="outline"
          :disabled="isLoading"
          @click="showAddVideoModal = true"
        >
          添加视频
        </Button>
      </div>

      <Empty
        v-if="accountInfo.settings.index.videos.length === 0"
        description="暂无展示视频"
        class="py-4"
      />
      <div
        v-else
        class="flex flex-col gap-3 w-full"
      >
        <div
          v-for="item in indexDisplayInfo?.videos ?? []"
          :key="item.id"
          class="w-full flex flex-col gap-1.5"
        >
          <SimpleVideoCard :video="item" />
          <div class="flex items-center gap-1.5">
            <Button
              variant="outline"
              class="h-6 px-2"
              :disabled="isLoading"
              @click="moveVideo(item.id, 'up')"
            >
              上移
            </Button>
            <Button
              variant="outline"
              class="h-6 px-2"
              :disabled="isLoading"
              @click="moveVideo(item.id, 'down')"
            >
              下移
            </Button>
            <Button
              variant="destructive"
              class="h-6 px-2"
              :disabled="isLoading"
              @click="removeVideo(item.id)"
            >
              删除
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 其他链接 -->
    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="flex items-center justify-between">
        <div class="text-xs font-semibold text-muted-foreground uppercase">其他链接</div>
        <Button
          variant="outline"
          :disabled="isLoading"
          @click="showAddLinkModal = true"
        >
          添加链接
        </Button>
      </div>

      <Empty
        v-if="Object.entries(indexDisplayInfo?.links ?? {}).length === 0"
        description="暂无外部链接"
        class="py-4"
      />
      <div
        v-else
        :key="linkKey"
        class="links-list flex flex-col gap-1.5"
      >
        <div
          v-for="link in orderedLinks"
          :key="link[0]"
          class="link-item-row flex items-center justify-between p-2 rounded-lg border border-border bg-card text-xs gap-2"
        >
          <template v-if="editingLinkName === link[0]">
            <div class="flex items-center gap-1.5 w-full">
              <Input
                size="xs"
                v-model="newLinkName"
                class="flex-1"
              />
              <Button
                size="xs"
                class="px-2"
                @click="confirmEditLink(link[0])"
              >
                保存
              </Button>
              <Button
                size="xs"
                variant="outline"
                class="px-2"
                @click="cancelEditLink"
              >
                取消
              </Button>
            </div>
          </template>
          <template v-else>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Tag
                    variant="secondary"
                    class="max-w-[140px] truncate cursor-help"
                  >
                    {{ link[0] }}
                  </Tag>
                </TooltipTrigger>
                <TooltipContent class="text-xs max-w-xs break-all">
                  {{ link[1] }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                class="size-6 p-0"
                aria-label="上移链接"
                @click="moveLink(link[0], 'up')"
              >
                <component
                  :is="ArrowUpOutline"
                  class="size-3.5"
                />
              </Button>
              <Button
                variant="ghost"
                class="size-6 p-0"
                aria-label="下移链接"
                @click="moveLink(link[0], 'down')"
              >
                <component
                  :is="ArrowDownOutline"
                  class="size-3.5"
                />
              </Button>
              <Button
                variant="outline"
                class="h-6 px-2"
                @click="startEditLink(link[0])"
              >
                改名
              </Button>
              <Popconfirm
                title="确定要删除这个链接吗？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="removeLink(link[0])"
              >
                <Button
                  variant="ghost"
                  class="size-6 p-0 text-destructive hover:text-destructive"
                  aria-label="删除链接"
                >
                  <component
                    :is="Delete24Regular"
                    class="size-3.5"
                  />
                </Button>
              </Popconfirm>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加视频弹窗 -->
  <Dialog v-model:open="showAddVideoModal">
    <DialogContent class="max-w-md p-4">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">添加视频</DialogTitle>
      </DialogHeader>
      <div class="py-2 flex flex-col gap-2">
        <Input
          v-model="addVideoUrl"
          placeholder="请输入 Bilibili 视频链接或 BV 号"
        />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          @click="showAddVideoModal = false"
          >取消</Button
        >
        <Button
          :disabled="isLoading"
          @click="addVideo"
          >添加视频</Button
        >
      </div>
    </DialogContent>
  </Dialog>

  <!-- 添加链接弹窗 -->
  <Dialog v-model:open="showAddLinkModal">
    <DialogContent class="max-w-md p-4">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">添加链接</DialogTitle>
      </DialogHeader>
      <div class="py-2 flex flex-col gap-2">
        <Input
          v-model="addLinkName"
          placeholder="链接名称（如：个人博客、网易云等）"
        />
        <Input
          v-model="addLinkUrl"
          placeholder="链接地址（必须以 http:// 或 https:// 开头）"
        />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          @click="showAddLinkModal = false"
          >取消</Button
        >
        <Button
          :disabled="isLoading"
          @click="addLink"
          >添加链接</Button
        >
      </div>
    </DialogContent>
  </Dialog>

  <!-- 模板预览弹窗 -->
  <Dialog v-model:open="showTemplatePreview">
    <DialogContent class="max-w-4xl p-4 max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">主页模板预览 - {{ selectedIndexTemplate.name }}</DialogTitle>
      </DialogHeader>
      <div class="flex-1 overflow-y-auto mt-2 border border-border rounded-lg p-2 bg-background">
        <component
          :is="selectedIndexTemplate.component"
          :user-info="accountInfo"
          :bili-info="undefined"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
