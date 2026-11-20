<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowDownload24Regular from '@vicons/fluent/es/ArrowDownload24Regular'
import ArrowUpload24Regular from '@vicons/fluent/es/ArrowUpload24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Play24Regular from '@vicons/fluent/es/Play24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { computed, ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import {
  postApiMusicRequestAdd,
  postApiMusicRequestClear,
  postApiMusicRequestDelete,
} from '@/api/generated/music-request/music-request'
import { getApiSongListGet, getApiSongListGetNeteaseList } from '@/api/generated/song-list/song-list'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useMessage } from '@/shared/utils'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const message = useMessage()
const musicRequestStore = useMusicRequestProvider()

const originMusics = computed(() => musicRequestStore.originMusics)
const songListFilter = ref('')

const filteredOriginMusics = computed(() => {
  const kw = songListFilter.value.trim().toLowerCase()
  if (!kw) return originMusics.value
  return originMusics.value.filter(
    (m) => m.name.toLowerCase().includes(kw) || m.author?.some((a) => a.toLowerCase().includes(kw)),
  )
})

// 搜索单曲加入闲置曲库
const quickLibraryKeyword = ref('')
const isAddingSingle = ref(false)
async function quickAddToLibrary() {
  const kw = quickLibraryKeyword.value.trim()
  if (!kw) {
    message.warning('请输入要添加的歌曲关键词')
    return
  }
  isAddingSingle.value = true
  try {
    const song = await musicRequestStore.searchOnlineSong(kw)
    if (!song) {
      message.warning(`未搜到歌曲「${kw}」`)
      return
    }
    const res = await postApiMusicRequestAdd([song as any])
    if (res.code === 200) {
      message.success(`已添加《${song.name}》到闲置曲库`)
      quickLibraryKeyword.value = ''
      await musicRequestStore.loadLibrary()
    } else {
      message.error(res.message || '添加失败')
    }
  } catch (err) {
    message.error(`添加失败: ${err instanceof Error ? err.message : '网络错误'}`)
  } finally {
    isAddingSingle.value = false
  }
}

async function delMusic(song: ResponseSongModel) {
  try {
    const res = await postApiMusicRequestDelete([song.key])
    if (res.code === 200) {
      message.success(`已删除歌曲: ${song.name}`)
      await musicRequestStore.loadLibrary()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch (err) {
    message.error(`删除失败: ${err instanceof Error ? err.message : '网络错误'}`)
  }
}

async function clearOriginMusics() {
  try {
    const res = await postApiMusicRequestClear()
    if (res.code === 200) {
      message.success('已清空闲置歌单')
      musicRequestStore.originMusics = []
    } else {
      message.error(res.message || '清空失败')
    }
  } catch (err) {
    message.error(`清空失败: ${err instanceof Error ? err.message : '网络错误'}`)
  }
}

// 从我的歌单同步
const isSyncingMySongList = ref(false)
async function syncFromMySongList() {
  isSyncingMySongList.value = true
  try {
    const res = await getApiSongListGet()
    if (res.code === 200 && res.data && res.data.length > 0) {
      const addRes = await postApiMusicRequestAdd(res.data as any)
      if (addRes.code === 200) {
        message.success(`已成功从我的歌单同步 ${res.data.length} 首歌曲`)
        await musicRequestStore.loadLibrary()
      } else {
        message.error(addRes.message || '导入失败')
      }
    } else {
      message.warning('我的歌单中暂无歌曲可同步')
    }
  } catch (err) {
    message.error(`同步失败: ${err instanceof Error ? err.message : '网络错误'}`)
  } finally {
    isSyncingMySongList.value = false
  }
}

// 网易云歌单导入弹窗
const showNeteaseModal = ref(false)
const neteaseIdInput = ref('')
const neteaseSongListId = computed(() => {
  const raw = neteaseIdInput.value.trim()
  const match = raw.match(/[?&]id=(\d+)/) || raw.match(/^(\d+)$/)
  return match ? match[1] : ''
})
const isNeteaseLoading = ref(false)
const neteaseSongs = ref<ResponseSongModel[]>([])
const selectedNeteaseKeys = ref<string[]>([])

async function loadNeteasePlaylist() {
  if (!/^\d+$/.test(neteaseSongListId.value)) {
    message.warning('请输入有效的网易云歌单链接或 ID')
    return
  }
  isNeteaseLoading.value = true
  try {
    const res = await getApiSongListGetNeteaseList({ id: Number(neteaseSongListId.value) })
    if (res.code === 200 && res.data) {
      neteaseSongs.value = res.data as unknown as ResponseSongModel[]
      selectedNeteaseKeys.value = res.data
        .filter((s) => !originMusics.value.some((exist) => exist.from === SongPlatform.Netease && exist.id === s.id))
        .map((s) => s.key)
      message.success(`成功解析 ${res.data.length} 首歌曲`)
    } else {
      message.error(res.message || '获取网易云歌单失败')
    }
  } catch (err) {
    message.error(`拉取失败: ${err instanceof Error ? err.message : '网络错误'}`)
  } finally {
    isNeteaseLoading.value = false
  }
}

function selectAllNetease() {
  selectedNeteaseKeys.value = neteaseSongs.value.map((s) => s.key)
}

function deselectAllNetease() {
  selectedNeteaseKeys.value = []
}

async function confirmImportNetease() {
  const toImport = neteaseSongs.value.filter((s) => selectedNeteaseKeys.value.includes(s.key))
  if (toImport.length === 0) {
    message.warning('请至少选择一首歌曲')
    return
  }
  isNeteaseLoading.value = true
  try {
    const res = await postApiMusicRequestAdd(toImport as any)
    if (res.code === 200) {
      message.success(`已成功导入 ${toImport.length} 首歌曲到曲库`)
      showNeteaseModal.value = false
      neteaseIdInput.value = ''
      neteaseSongs.value = []
      await musicRequestStore.loadLibrary()
    } else {
      message.error(res.message || '导入失败')
    }
  } catch (err) {
    message.error(`导入失败: ${err instanceof Error ? err.message : '网络错误'}`)
  } finally {
    isNeteaseLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <Card>
      <CardContent class="p-3.5 space-y-3">
        <div class="flex-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <Badge variant="brand"> 闲置曲库: {{ originMusics.length }} 首 </Badge>
            <span class="text-xs text-muted-foreground hidden sm:inline">观众点歌可优先命中此曲库，空闲时自动轮播</span>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative w-48">
              <Search24Regular
                class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              />
              <Input
                v-model="songListFilter"
                placeholder="筛选曲库歌名或歌手"
                class="pl-8"
              />
            </div>

            <Button
              variant="outline"
              @click="showNeteaseModal = true"
            >
              <ArrowDownload24Regular class="size-4 mr-1" />
              网易云导入
            </Button>

            <Button
              variant="outline"
              :loading="isSyncingMySongList"
              @click="syncFromMySongList"
            >
              <ArrowUpload24Regular class="size-4 mr-1" />
              我的歌单同步
            </Button>

            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button
                  variant="ghost"
                  class="text-destructive hover:bg-destructive/10"
                  :disabled="originMusics.length === 0"
                >
                  清空曲库
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent class="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>清空全部闲置曲库？</AlertDialogTitle>
                  <AlertDialogDescription> 此操作将从闲置曲库中删除全部已导入歌曲。 </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    @click="clearOriginMusics"
                  >
                    确认清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-border/60">
          <Input
            v-model="quickLibraryKeyword"
            placeholder="输入歌名快速搜索并收录到闲置曲库..."
            class="flex-1"
            @keyup.enter="quickAddToLibrary"
          />
          <Button
            :loading="isAddingSingle || musicRequestStore.isSearchingSong"
            @click="quickAddToLibrary"
          >
            <Add24Regular class="size-4 mr-1" />
            搜歌入库
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-3">
        <ScrollArea
          v-if="filteredOriginMusics.length > 0"
          class="h-[520px]"
        >
          <div
            class="hidden sm:grid grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem] items-center gap-3 px-2.5 pb-2 text-xs text-muted-foreground border-b border-border"
          >
            <span class="text-right font-mono">#</span>
            <span>歌曲名</span>
            <span>歌手 / 作者</span>
            <span class="text-right pr-1">操作</span>
          </div>

          <div class="divide-y divide-border">
            <div
              v-for="(song, idx) in filteredOriginMusics"
              :key="song.key || song.id"
              class="grid grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem] items-center gap-3 py-2 px-2.5 hover:bg-muted/40 rounded transition-colors text-xs"
            >
              <span class="font-mono tabular-nums text-muted-foreground text-right">{{ idx + 1 }}</span>
              <span class="font-medium text-foreground truncate min-w-0">{{ song.name }}</span>
              <span class="text-muted-foreground truncate min-w-0">{{ (song.author || []).join('/') || '-' }}</span>

              <div class="flex items-center justify-end gap-1.5 shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-primary hover:bg-primary/10"
                  aria-label="试听/播放"
                  @click="musicRequestStore.playMusic(song)"
                >
                  <Play24Regular class="size-3.5" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="删除"
                    >
                      <Delete24Regular class="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent class="sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>删除歌曲？</AlertDialogTitle>
                      <AlertDialogDescription> 确定从曲库中删除《{{ song.name }}》吗？ </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        @click="delMusic(song)"
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </ScrollArea>
        <div
          v-else
          class="text-center py-12 text-xs text-muted-foreground"
        >
          {{ songListFilter ? '没有匹配的曲目' : '闲置曲库暂无歌曲，可通过上方搜歌入库、网易云导入或我的歌单同步' }}
        </div>
      </CardContent>
    </Card>

    <!-- 网易云歌单导入弹窗 -->
    <Dialog v-model:open="showNeteaseModal">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>从网易云歌单导入曲目到闲置歌单</DialogTitle>
          <DialogDescription>
            粘贴网易云音乐歌单链接（例如 <code>https://music.163.com/playlist?id=123456</code>）或纯歌单
            ID，点击解析后批量导入。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="flex gap-2">
            <Input
              v-model="neteaseIdInput"
              placeholder="粘贴网易云歌单链接或歌单 ID"
              class="flex-1"
              @keyup.enter="loadNeteasePlaylist"
            />
            <Button
              :loading="isNeteaseLoading"
              @click="loadNeteasePlaylist"
            >
              解析歌单
            </Button>
          </div>

          <div
            v-if="neteaseSongs.length > 0"
            class="space-y-2 border border-border rounded-lg p-3 bg-muted/20"
          >
            <div class="flex-between">
              <span class="text-xs text-muted-foreground">
                共解析出 {{ neteaseSongs.length }} 首，已勾选 {{ selectedNeteaseKeys.length }} 首
              </span>
              <div class="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="ghost"
                  @click="selectAllNetease"
                >
                  全选
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  @click="deselectAllNetease"
                >
                  取消全选
                </Button>
              </div>
            </div>

            <ScrollArea class="h-64 rounded border border-border p-2 bg-background">
              <div class="space-y-1.5">
                <label
                  v-for="song in neteaseSongs"
                  :key="song.key"
                  class="flex items-center gap-2 p-1.5 hover:bg-muted/40 rounded cursor-pointer text-xs select-none"
                >
                  <Checkbox
                    :model-value="selectedNeteaseKeys.includes(song.key)"
                    @update:model-value="
                      (val) => {
                        if (val) {
                          selectedNeteaseKeys.push(song.key)
                        } else {
                          selectedNeteaseKeys = selectedNeteaseKeys.filter((k) => k !== song.key)
                        }
                      }
                    "
                  />
                  <span class="font-medium text-foreground truncate">{{ song.name }}</span>
                  <span class="text-muted-foreground truncate">- {{ (song.author || []).join('/') }}</span>
                </label>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showNeteaseModal = false"
          >
            取消
          </Button>
          <Button
            :loading="isNeteaseLoading"
            :disabled="selectedNeteaseKeys.length === 0"
            @click="confirmImportNetease"
          >
            确认导入 ({{ selectedNeteaseKeys.length }} 首)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
