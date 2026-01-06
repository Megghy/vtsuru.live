<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { watch, ref, computed, onMounted, onUnmounted } from 'vue'
import { startLive, stopLive, updateRoom, getLiveAreas, getLiveVersion, updateRoomNews, uploadCover, updateCover } from '@/apps/client/api/live-manage'
import type { LiveArea } from '@/apps/client/api/live-manage'
import type { UploadFileInfo } from 'naive-ui'
import { useAccount } from '@/api/account'
import { roomInfo } from '@/apps/client/data/info'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { useOBSStore } from '@/apps/client/store/useOBSStore'

const accountInfo = useAccount()
const obsStore = useOBSStore()

// 状态
const isLiving = ref(false)
// const isRelaying = ref(false)
// const localRtmpUrl = ref('')
// const targetRtmpUrl = ref('')
const clientVersion = ref('')
// const isVersionSupported = ref(true)
const rtmpServer = ref('')
const rtmpCode = ref('')

interface RtmpInfoState {
  server: string
  code: string
}

const RTMP_INFO_KEY = 'webfetcher.rtmpInfo'
const tauriStore = useTauriStore()

// interface RtmpRelayState {
//   roomId: number
//   targetRtmpUrl: string
// }

// const RTMP_RELAY_STATE_KEY = 'webfetcher.rtmpRelay'
// const tauriStore = useTauriStore()

// interface FfmpegStatus {
//   available: boolean
//   source?: string
//   path?: string
//   version?: string
//   error?: string
// }

// interface RtmpRelayStatus {
//   is_running: boolean
//   local_port: number
//   target_url?: string | null
//   is_relaying: boolean
//   bitrate_kbps?: number | null
//   speed?: number | null
// }

// const ffmpegStatus = ref<FfmpegStatus | null>(null)
// const isCheckingFfmpeg = ref(false)
// const isDownloadingFfmpeg = ref(false)
// const rtmpBitrateKbps = ref<number | null>(null)
// const rtmpSpeed = ref<number | null>(null)
// const showTargetRtmpDetails = ref(false)

// 直播设置
const liveAreaId = ref(0)
const liveTitle = ref('')
const hasEditedTitle = ref(false)
const hasEditedArea = ref(false)
const roomAnnouncement = ref('')
const liveAreas = ref<LiveArea[]>([])
const coverFile = ref<File | null>(null)
const coverPreviewUrl = ref('')
const uploadedCoverUrl = ref('')
const isUploadingCover = ref(false)
const isUpdatingAnnouncement = ref(false)
const areaOptions = computed(() => {
  const parentMap = new Map<number, { label: string; value: number; children: { label: string; value: number }[] }>()
  
  liveAreas.value.forEach(area => {
    if (!parentMap.has(area.parent_id)) {
      parentMap.set(area.parent_id, {
        label: area.parent_name,
        value: area.parent_id,
        children: []
      })
    }
    parentMap.get(area.parent_id)!.children.push({
      label: area.name,
      value: area.id
    })
  })
  
  return Array.from(parentMap.values())
})

// 根据房间信息尝试同步直播分区（仅在当前未选择分区且分区存在于列表中时生效）
function syncAreaFromRoomInfo() {
  const info = roomInfo.value
  if (!info || liveAreaId.value) return

  const areaId = Number(info.area_id)
  const areaName = info.area_name?.trim()
  const parentName = info.parent_area_name?.trim()

  if (!areaId && !areaName) return

  // 1. 优先按 id 精确匹配
  let matched = liveAreas.value.find(area => area.id === areaId)

  // 2. 如果 id 找不到，尝试用名称匹配（父分区名 + 子分区名）
  if (!matched && areaName) {
    matched = liveAreas.value.find(area => {
      const childNameMatch = area.name === areaName
      const parentMatch = parentName ? area.parent_name === parentName : true
      return childNameMatch && parentMatch
    })
  }

  if (matched) {
    liveAreaId.value = matched.id
  }
}

// let rtmpStatsTimer: number | null = null

// const fetchRtmpStats = async () => {
//   try {
//     const status = await invoke<RtmpRelayStatus>('get_rtmp_relay_status')
//     if (status) {
//       isRelaying.value = status.is_relaying
//       rtmpBitrateKbps.value = status.bitrate_kbps ?? null
//       rtmpSpeed.value = status.speed ?? null
//       if (!status.is_relaying) {
//         if (rtmpStatsTimer !== null) {
//           clearInterval(rtmpStatsTimer)
//           rtmpStatsTimer = null
//         }
//       }
//     }
//   }
//   catch (err) {
//     console.error('获取RTMP转发统计失败:', err)
//   }
// }

const handleUpdateAnnouncement = async () => {
  const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
  if (!roomId) {
    window.$message.error('无法获取直播间ID')
    return
  }

  if (roomAnnouncement.value.length > 60) {
    window.$message.error('公告内容不能超过60个字符')
    return
  }

  try {
    isUpdatingAnnouncement.value = true
    window.$message.info('正在更新直播间公告...')
    const response = await updateRoomNews({
      roomId,
      content: roomAnnouncement.value,
    })

    if (response.code === 0) {
      window.$message.success('直播间公告更新成功！')
    }
    else {
      window.$message.error(`更新公告失败: ${response.message || '未知错误'}`)
    }
  }
  catch (err: any) {
    console.error('更新直播间公告失败:', err)
    window.$message.error(`更新公告失败: ${err.message || err}`)
  }
  finally {
    isUpdatingAnnouncement.value = false
  }
}

const handleCoverFileChange = (file: UploadFileInfo) => {
  if (!file.file) {
    coverFile.value = null
    coverPreviewUrl.value = ''
    return
  }
  coverFile.value = file.file
  coverPreviewUrl.value = URL.createObjectURL(file.file)
}

const handleCoverRemove = () => {
  coverFile.value = null
  coverPreviewUrl.value = ''
}

const handleUploadCover = async () => {
  if (!coverFile.value) {
    window.$message.error('请先选择要上传的封面图片')
    return
  }

  try {
    isUploadingCover.value = true
    window.$message.info('正在上传并应用封面...')
    const uploadResponse = await uploadCover(coverFile.value)
    if (uploadResponse.code === 0 && uploadResponse.data?.location) {
      uploadedCoverUrl.value = uploadResponse.data.location

      const updateResponse = await updateCover(uploadResponse.data.location)
      if (updateResponse.code === 0) {
        window.$message.success('封面上传并应用成功！')
      }
      else {
        window.$message.error(`封面上传成功但应用失败: ${updateResponse.message || '未知错误'}`)
      }
    }
    else {
      window.$message.error(`封面上传失败: ${uploadResponse.message || '未知错误'}`)
    }
  }
  catch (err: any) {
    console.error('封面上传或应用失败:', err)
    window.$message.error(`封面上传或应用失败: ${err.message || err}`)
  }
  finally {
    isUploadingCover.value = false
  }
}

const markTitleEdited = () => {
  hasEditedTitle.value = true
}

const markAreaEdited = () => {
  hasEditedArea.value = true
}

const titleChanged = computed(() => {
  const info = roomInfo.value
  if (!info) return false
  // 只有用户实际编辑过标题且当前值与房间信息不同，才认为已修改
  return !!hasEditedTitle.value && !!liveTitle.value && liveTitle.value !== (info.title || '')
})

const areaChanged = computed(() => {
  const info = roomInfo.value
  if (!info) return false
  return !!hasEditedArea.value && !!liveAreaId.value && liveAreaId.value !== Number(info.area_id)
})

const needUpdateBeforeLive = computed(() => {
  const info = roomInfo.value
  if (!info) return false

  return titleChanged.value || areaChanged.value
})

const handleStartLiveWithUpdate = async () => {
  const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
  if (!roomId) {
    window.$message.error('无法获取直播间ID')
    return
  }

  try {
    window.$message.info('正在更新直播间信息...')

    const response = await updateRoom({
      roomId,
      title: liveTitle.value || undefined,
      areaId: liveAreaId.value || undefined,
    })

    if (response.code === 0) {
      window.$message.success('直播间信息更新成功，开始开播...')
      if (roomInfo.value) {
        if (liveTitle.value) {
          roomInfo.value.title = liveTitle.value
        }
        if (liveAreaId.value) {
          // @ts-ignore - roomInfo 中的 area_id 为后端返回字段
          roomInfo.value.area_id = liveAreaId.value
        }
      }
      await handleStartLive()
    }
    else {
      window.$message.error(`更新直播间信息失败: ${response.message || response.msg}`)
    }
  }
  catch (err: any) {
    console.error('更新直播间信息失败:', err)
    window.$message.error(`更新直播间信息失败: ${err.message || err}`)
  }
}

// 检查客户端版本
const checkClientVersion = async () => {
  try {
    const version = await getVersion()
    clientVersion.value = version
  }
  catch (err) {
    console.error('获取客户端版本失败:', err)
    // isVersionSupported.value = false
  }
}

// 检测 FFmpeg 状态
// const fetchFfmpegStatus = async () => {
//   isCheckingFfmpeg.value = true
//   try {
//     const status = await invoke<FfmpegStatus>('get_ffmpeg_status')
//     ffmpegStatus.value = status
//   }
//   catch (err) {
//     console.error('获取FFmpeg状态失败:', err)
//     window.$message.error('获取FFmpeg状态失败')
//   }
//   finally {
//     isCheckingFfmpeg.value = false
//   }
// }

// 同步 RTMP 转发状态（用于页面刷新后的恢复）
// const syncRtmpRelayState = async () => {
//   try {
//     const saved = await tauriStore.get<RtmpRelayState | null>(RTMP_RELAY_STATE_KEY)
//     if (saved && saved.targetRtmpUrl) {
//       targetRtmpUrl.value = saved.targetRtmpUrl
//     }
//
//     const status = await invoke<RtmpRelayStatus>('get_rtmp_relay_status')
//     if (status) {
//       isRelaying.value = status.is_relaying
//       if (!targetRtmpUrl.value && status.target_url) {
//         targetRtmpUrl.value = status.target_url
//       }
//       rtmpBitrateKbps.value = status.bitrate_kbps ?? null
//       rtmpSpeed.value = status.speed ?? null
//     }
//
//     if (roomInfo.value && roomInfo.value.live_status === 1) {
//       isLiving.value = true
//     }
//   }
//   catch (err) {
//     console.error('同步RTMP转发状态失败:', err)
//   }
// }

// 下载 FFmpeg
// const handleDownloadFfmpeg = async () => {
//   if (isDownloadingFfmpeg.value) return
//
//   isDownloadingFfmpeg.value = true
//   try {
//     window.$message.info('正在下载FFmpeg...')
//     const status = await invoke<FfmpegStatus>('download_ffmpeg')
//     ffmpegStatus.value = status
//
//     if (status.available) {
//       window.$message.success('FFmpeg 已准备就绪')
//     } else {
//       window.$message.error('FFmpeg 下载完成但检测失败，请稍后重试')
//     }
//   }
//   catch (err: any) {
//     console.error('下载FFmpeg失败:', err)
//     window.$message.error(`下载FFmpeg失败: ${err?.message || err}`)
//   }
//   finally {
//     isDownloadingFfmpeg.value = false
//   }
// }

// 加载直播分区
const loadLiveAreas = async () => {
  try {
    liveAreas.value = await getLiveAreas()
    console.log('已加载直播分区:', liveAreas.value.length)
  }
  catch (err) {
    console.error('加载直播分区失败:', err)
    window.$message.error('加载直播分区失败')
  }
}

// 获取本地RTMP地址
// const getLocalRtmpUrl = async () => {
//   try {
//     const url = await invoke<string>('get_rtmp_local_url')
//     localRtmpUrl.value = url
//   }
//   catch (err) {
//     console.error('获取本地RTMP地址失败:', err)
//   }
// }

// 人脸认证二维码
const faceAuthQrCode = ref('')
const showFaceAuthModal = ref(false)

// 直播姬版本信息
const liveVersionInfo = ref<{ version: string; build: number } | null>(null)

// 获取直播姬版本号
const fetchLiveVersion = async () => {
  const versionInfo = await getLiveVersion()
  if (versionInfo) {
    liveVersionInfo.value = {
      version: versionInfo.curr_version,
      build: versionInfo.build,
    }
    console.log('直播姬版本:', versionInfo.curr_version, '构建号:', versionInfo.build)
  }
}

// 开始直播
const handleStartLive = async () => {
  if (!liveAreaId.value) {
    window.$message.error('请选择直播分区')
    return
  }

  const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
  if (!roomId) {
    window.$message.error('无法获取直播间ID')
    return
  }

  try {
    window.$message.info('正在开播...')
    
    // 确保已获取直播姬版本
    if (!liveVersionInfo.value) {
      await fetchLiveVersion()
    }
    
    // 调用B站开播API，使用真实的直播姬版本号
    const response = await startLive({
      roomId,
      areaV2: liveAreaId.value,
      platform: 'pc_link',
      version: liveVersionInfo.value?.version || '7.19.0.9432',
      build: liveVersionInfo.value?.build || 9432,
    })

    // 处理不同的响应码
    if (response.code === 60024) {
      // 需要人脸认证
      window.$message.warning('需要进行人脸认证')
      if (response.data?.qr) {
        faceAuthQrCode.value = response.data.qr
        showFaceAuthModal.value = true
      } else {
        window.$message.error('无法获取人脸认证二维码')
      }
      return
    }
    
    if (response.code === 0 && response.data) {
      const rtmp = response.data.rtmp
      rtmpServer.value = rtmp.addr
      rtmpCode.value = rtmp.code

      try {
        await tauriStore.set(RTMP_INFO_KEY, {
          server: rtmpServer.value,
          code: rtmpCode.value,
        } as RtmpInfoState)
      }
      catch (err) {
        console.error('保存推流信息失败:', err)
      }

      // const rtmpAddr = response.data.rtmp.addr + response.data.rtmp.code
      // targetRtmpUrl.value = rtmpAddr

      // const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
      // if (roomId) {
      //   const state: RtmpRelayState = {
      //     roomId,
      //     targetRtmpUrl: rtmpAddr,
      //   }
      //   await tauriStore.set(RTMP_RELAY_STATE_KEY, state)
      // }

      window.$message.success('开播成功！')
      
      // 设置直播状态
      isLiving.value = true
      
      // 自动切换到开播场景（不影响直播流程）
      if (obsStore.obsSceneConfig.autoSwitchEnabled && obsStore.obsSceneConfig.startScene) {
        try {
          const switched = await obsStore.switchToScene(obsStore.obsSceneConfig.startScene)
          if (!switched) {
            console.warn('开播场景切换失败，但直播已正常开始')
          }
        } catch (err) {
          console.error('开播场景切换异常:', err)
        }
      }
      
      // 自动开始 OBS 推流（在开播之后）
      if (obsStore.obsSceneConfig.autoToggleStream && obsStore.obsConnected) {
        try {
          await obsStore.startObsStream()
        } catch (err) {
          console.error('自动开始 OBS 推流异常:', err)
        }
      }
    }
    else {
      window.$message.error(`开播失败: ${response.message || response.msg}`)
      console.error('开播失败详情:', response)
    }
  }
  catch (err: any) {
    console.error('开播失败:', err)
    window.$message.error(`开播失败: ${err.message || err}`)
  }
}

// 关闭人脸认证弹窗
const closeFaceAuthModal = () => {
  showFaceAuthModal.value = false
  faceAuthQrCode.value = ''
}

// 停止直播
const handleStopLive = async () => {
  const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
  if (!roomId) {
    window.$message.error('无法获取直播间ID')
    return
  }

  try {
    window.$message.info('正在下播...')
    
    // 自动停止 OBS 推流（在下播之前）
    if (obsStore.obsSceneConfig.autoToggleStream && obsStore.obsConnected) {
      try {
        await obsStore.stopObsStream()
      } catch (err) {
        console.error('自动停止 OBS 推流异常:', err)
      }
    }
    
    // 调用B站下播API
    const response = await stopLive({
      roomId,
      platform: 'pc_link',
    })

    if (response.code === 0) {
      window.$message.success('下播成功！')
      
      // 设置直播状态
      isLiving.value = false
      
      // 自动切换到下播场景（不影响下播流程）
      if (obsStore.obsSceneConfig.autoSwitchEnabled && obsStore.obsSceneConfig.stopScene) {
        try {
          const switched = await obsStore.switchToScene(obsStore.obsSceneConfig.stopScene)
          if (!switched) {
            console.warn('下播场景切换失败，但下播已正常完成')
          }
        } catch (err) {
          console.error('下播场景切换异常:', err)
        }
      }
      // rtmpServer.value = ''
      // rtmpCode.value = ''
      // targetRtmpUrl.value = ''

      // await tauriStore.set(RTMP_RELAY_STATE_KEY, null)
    }
    else {
      window.$message.error(`下播失败: ${response.message || response.msg}`)
    }
  }
  catch (err: any) {
    console.error('下播失败:', err)
    window.$message.error(`下播失败: ${err.message || err}`)
  }
}

// 更新直播间信息
const handleUpdateRoom = async () => {
  if (!liveTitle.value && !liveAreaId.value) {
    window.$message.error('请至少填写一项要修改的信息')
    return
  }

  const roomId = accountInfo.value.biliRoomId || accountInfo.value.streamerInfo?.roomId
  if (!roomId) {
    window.$message.error('无法获取直播间ID')
    return
  }

  try {
    window.$message.info('正在更新直播间信息...')
    
    const response = await updateRoom({
      roomId,
      title: liveTitle.value || undefined,
      areaId: liveAreaId.value || undefined,
    })

    if (response.code === 0) {
      window.$message.success('直播间信息更新成功！')
      if (roomInfo.value) {
        if (liveTitle.value) {
          roomInfo.value.title = liveTitle.value
        }
        if (liveAreaId.value) {
          // @ts-ignore
          roomInfo.value.area_id = liveAreaId.value
        }
      }
    }
    else {
      window.$message.error(`更新失败: ${response.message || response.msg}`)
    }
  }
  catch (err: any) {
    console.error('更新直播间信息失败:', err)
    window.$message.error(`更新失败: ${err.message || err}`)
  }
}

// 启动RTMP转发
// const startRtmpRelay = async (targetUrl: string) => {
//   try {
//     await invoke('start_rtmp_relay', { targetUrl })
//     isRelaying.value = true
//     window.$message.success('RTMP转发已启动')
//   }
//   catch (err: any) {
//     console.error('启动RTMP转发失败:', err)
//     window.$message.error(`启动RTMP转发失败: ${err}`)
//   }
// }

// 停止RTMP转发
// const stopRtmpRelay = async () => {
//   try {
//     await invoke('stop_rtmp_relay')
//     isRelaying.value = false
//     window.$message.info('RTMP转发已停止')
//   }
//   catch (err: any) {
//     console.error('停止RTMP转发失败:', err)
//     window.$message.error(`停止RTMP转发失败: ${err}`)
//   }
// }

// 手动测试RTMP转发
// const handleTestRtmp = async () => {
//   if (!targetRtmpUrl.value) {
//     window.$message.error('请先开播获取目标RTMP地址')
//     return
//   }
//   
//   try {
//     if (isRelaying.value) {
//       await stopRtmpRelay()
//       window.$message.success('RTMP测试已停止')
//     } else {
//       await startRtmpRelay(targetRtmpUrl.value)
//       window.$message.success('RTMP测试已启动，请在OBS中开始推流')
//     }
//   }
//   catch (err: any) {
//     console.error('RTMP测试失败:', err)
//     window.$message.error(`RTMP测试失败: ${err}`)
//   }
// }

// 复制到剪贴板
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    window.$message.success('已复制到剪贴板')
  }).catch((err) => {
    console.error('复制失败:', err)
    window.$message.error('复制失败')
  })
}

// 同步推流码到 OBS
const handleSyncStreamKeyToObs = async () => {
  if (!rtmpServer.value || !rtmpCode.value) {
    window.$message.error('推流信息不完整')
    return
  }
  
  await obsStore.syncStreamKeyToObs(rtmpServer.value, rtmpCode.value)
}

// 初始化
onMounted(async () => {
  await checkClientVersion()
  await loadLiveAreas()
  // await getLocalRtmpUrl()
  await fetchLiveVersion() // 获取直播姬版本号
  // await fetchFfmpegStatus()
  // await syncRtmpRelayState()
  
  // 初始化OBS store
  await obsStore.init()

  try {
    const savedRtmp = await tauriStore.get<RtmpInfoState | null>(RTMP_INFO_KEY)
    if (savedRtmp) {
      rtmpServer.value = savedRtmp.server || ''
      rtmpCode.value = savedRtmp.code || ''
    }
  }
  catch (err) {
    console.error('加载已保存的推流信息失败:', err)
  }
  
  // 从当前直播间信息获取初始值
  if (roomInfo.value) {
    liveTitle.value = roomInfo.value.title || ''
    roomAnnouncement.value = roomInfo.value.description || ''
    syncAreaFromRoomInfo()
  }
})

onUnmounted(() => {
  //obsStore.cleanup()
})

// 当 roomInfo 异步更新且当前未选择分区时，同步一次分区
watch(roomInfo, (val) => {
  if (!val) return
  if (!liveTitle.value) {
    liveTitle.value = val.title || ''
  }
  if (!roomAnnouncement.value) {
    roomAnnouncement.value = val.description || ''
  }
  syncAreaFromRoomInfo()
})

// 当分区列表异步加载完成后，如果当前未选择分区且 roomInfo 中已有分区信息，也尝试同步一次
watch(liveAreas, () => {
  syncAreaFromRoomInfo()
})

// watch(isRelaying, (val) => {
//   if (val) {
//     if (rtmpStatsTimer !== null) {
//       clearInterval(rtmpStatsTimer)
//     }
//     // @ts-ignore - setInterval 在浏览器中返回 number
//     rtmpStatsTimer = window.setInterval(fetchRtmpStats, 1000)
//   }
//   else {
//     if (rtmpStatsTimer !== null) {
//       clearInterval(rtmpStatsTimer)
//       rtmpStatsTimer = null
//     }
//     rtmpBitrateKbps.value = null
//     rtmpSpeed.value = null
//   }
// })
</script>

<template>
  <div class="live-manage-page">
    <NFlex
      vertical
      gap="large"
    >
      <!-- 页面标题 -->
      <NCard
        embedded
        size="small"
        class="live-manage-card"
        :bordered="false"
      >
        <NFlex vertical gap="small">
          <NText strong style="font-size: 20px;">
            直播管理
          </NText>
          <NText depth="3">
            使用 OBS 直接推流到 B 站官方服务器，管理直播间信息和封面
          </NText>
        </NFlex>
      </NCard>

      <!-- 直播控制 -->
      <NCard
        title="直播控制"
        embedded
        size="small"
        class="live-manage-card"
      >
        <NFlex
          vertical
          gap="large"
        >
          <!-- 直播状态和操作 -->
          <div>
            <NFlex
              gap="medium"
              align="center"
              style="margin-bottom: 1rem;"
            >
              <NTag
                :type="isLiving ? 'success' : 'default'"
                size="large"
                :bordered="false"
                style="padding: 0.5rem 1rem;"
              >
                <template #icon>
                  <div
                    style="
                      width: 8px;
                      height: 8px;
                      border-radius: 50%;
                      background: currentColor;
                      margin-right: 0.5rem;
                    "
                  />
                </template>
                {{ isLiving ? '直播中' : '未开播' }}
              </NTag>
              
              <template v-if="!isLiving">
                <NPopconfirm
                  v-if="needUpdateBeforeLive"
                  @positive-click="handleStartLiveWithUpdate"
                >
                  <template #trigger>
                    <NButton
                      type="success"
                      size="large"
                      :disabled="!liveAreaId"
                    >
                      开始直播
                    </NButton>
                  </template>
                  检测到直播标题或分区已修改，是否先更新直播间信息再开播？
                </NPopconfirm>
                <NButton
                  v-else
                  type="success"
                  size="large"
                  :disabled="!liveAreaId"
                  @click="handleStartLive"
                >
                  开始直播
                </NButton>
              </template>
              <NButton
                v-else
                type="error"
                size="large"
                @click="handleStopLive"
              >
                停止直播
              </NButton>

              <!-- OBS 推流控制 -->
              <NTooltip v-if="obsStore.obsConnected && !isLiving">
                <template #trigger>
                  <NButton
                    :type="obsStore.obsStreamActive ? 'error' : 'primary'"
                    size="large"
                    disabled
                  >
                    {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
                  </NButton>
                </template>
                请先开始直播后再控制 OBS 推流
              </NTooltip>
              <NButton
                v-else-if="obsStore.obsConnected && isLiving"
                :type="obsStore.obsStreamActive ? 'error' : 'primary'"
                size="large"
                :loading="obsStore.isTogglingObsStream"
                @click="obsStore.handleObsToggleStream"
              >
                {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
              </NButton>

              <NButton
                v-if="!isLiving && liveTitle"
                type="primary"
                :disabled="!liveAreaId && !liveTitle"
                @click="handleUpdateRoom"
              >
                更新直播间信息
              </NButton>
            </NFlex>
          </div>

          <NDivider style="margin: 0;" />

          <!-- 直播间设置 -->
          <div>
            <NText
              strong
              style="font-size: 16px; display: block; margin-bottom: 1rem;"
            >
              直播间设置
            </NText>
            <NFlex
              vertical
              gap="medium"
            >
              <div>
                <NText strong>
                  直播间标题
                </NText>
                <NInput
                  v-model:value="liveTitle"
                  :status="titleChanged ? 'warning' : undefined"
                  placeholder="输入直播间标题"
                  maxlength="40"
                  show-count
                  size="large"
                  style="margin-top: 0.5rem;"
                  @update:value="markTitleEdited"
                />
              </div>

              <div>
                <NText strong>
                  直播分区
                </NText>
                <NCascader
                  v-model:value="liveAreaId"
                  :status="areaChanged ? 'warning' : undefined"
                  :options="areaOptions"
                  placeholder="请选择直播分区"
                  filterable
                  check-strategy="child"
                  size="large"
                  style="margin-top: 0.5rem;"
                  @update:value="markAreaEdited"
                />
              </div>
            </NFlex>
          </div>

          <NDivider style="margin: 0;" />

          <!-- 直播间公告 -->
          <div>
            <NText strong>
              直播间公告
            </NText>
            <NInput
              v-model:value="roomAnnouncement"
              type="textarea"
              placeholder="输入直播间公告（最多60个字符）"
              maxlength="60"
              show-count
              size="large"
              style="margin-top: 0.5rem;"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
            <NButton
              style="margin-top: 0.5rem;"
              type="primary"
              :loading="isUpdatingAnnouncement"
              @click="handleUpdateAnnouncement"
            >
              更新公告
            </NButton>
          </div>

          <NDivider style="margin: 0;" />

          <div>
            <NText strong>
              直播封面：
            </NText>
            <NFlex
              gap="medium"
              style="margin-top: 0.5rem;"
            >
              <!-- 现有封面显示 -->
              <div style="flex-shrink: 0;">
                <NText
                  depth="3"
                  style="display: block; margin-bottom: 0.5rem;"
                >
                  当前封面
                </NText>
                <div
                  style="
                    width: 160px;
                    height: 90px;
                    border-radius: 6px;
                    overflow: hidden;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <img
                    v-if="roomInfo?.user_cover || roomInfo?.keyframe"
                    :src="roomInfo?.user_cover || roomInfo?.keyframe"
                    alt="当前直播封面"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  >
                  <NText
                    v-else
                    depth="3"
                    style="font-size: 12px;"
                  >
                    暂无封面
                  </NText>
                </div>
              </div>

              <!-- 新封面上传和预览 -->
              <div style="flex: 1;">
                <NText
                  depth="3"
                  style="display: block; margin-bottom: 0.5rem;"
                >
                  上传新封面
                </NText>
                <NFlex
                  vertical
                  gap="small"
                >
                  <NFlex gap="small">
                    <NUpload
                      :max="1"
                      accept="image/*"
                      :file-list="coverFile ? [{
                        id: 'cover',
                        name: coverFile.name,
                        status: 'finished',
                        file: coverFile
                      }] : []"
                      @change="(options) => {
                        const { file, fileList } = options
                        if (fileList.length === 0) {
                          handleCoverRemove()
                        } else if (file) {
                          handleCoverFileChange(file)
                        }
                      }"
                      @before-upload="() => false"
                    >
                      <NButton>
                        选择图片
                      </NButton>
                    </NUpload>
                    <NButton
                      type="primary"
                      :loading="isUploadingCover"
                      :disabled="!coverFile"
                      @click="handleUploadCover"
                    >
                      上传并应用
                    </NButton>
                  </NFlex>
                  
                  <!-- 新封面预览 -->
                  <div
                    v-if="coverPreviewUrl"
                    style="
                      width: 160px;
                      height: 90px;
                      border-radius: 6px;
                      overflow: hidden;
                      border: 2px solid var(--n-border-color);
                    "
                  >
                    <img
                      :src="coverPreviewUrl"
                      alt="新封面预览"
                      style="width: 100%; height: 100%; object-fit: cover;"
                    >
                  </div>
                </NFlex>
              </div>
            </NFlex>
          </div>
        </NFlex>
      </NCard>

      <!-- RTMP推流信息 -->
      <NCard
        title="推流信息"
        embedded
        size="small"
        class="live-manage-card"
      >
        <NFlex
          vertical
          gap="medium"
        >
          <NAlert
            v-if="!rtmpServer"
            type="info"
            :bordered="false"
          >
            开播后将自动获取推流地址，请在 OBS 中配置使用
          </NAlert>

          <div>
            <NText strong>
              推流服务器
            </NText>
            <NInputGroup style="margin-top: 0.5rem;">
              <NInput
                :value="rtmpServer"
                readonly
                size="large"
                placeholder="开播后自动获取"
              />
              <NButton
                :disabled="!rtmpServer"
                size="large"
                @click="copyToClipboard(rtmpServer)"
              >
                复制
              </NButton>
            </NInputGroup>
          </div>

          <div>
            <NText strong>
              推流码
            </NText>
            <NInputGroup style="margin-top: 0.5rem;">
              <NInput
                :value="rtmpCode"
                readonly
                size="large"
                type="password"
                show-password-on="click"
                placeholder="开播后自动获取"
              />
              <NButton
                size="large"
                :disabled="!rtmpCode"
                @click="copyToClipboard(rtmpCode)"
              >
                复制
              </NButton>
              <NButton
                v-if="obsStore.obsConnected"
                type="primary"
                size="large"
                :disabled="!rtmpServer || !rtmpCode"
                @click="handleSyncStreamKeyToObs"
              >
                同步到 OBS
              </NButton>
            </NInputGroup>
          </div>

          <NText
            depth="3"
            style="font-size: 12px; margin-top: 0.25rem; display: block;"
          >
            请在 OBS 等推流软件中将服务器设置为上方地址，串流密钥设置为上方推流码。
          </NText>
        </NFlex>
      </NCard>

      <!-- OBS 控制 / 统计 -->
      <NCard
        embedded
        size="small"
        class="live-manage-card"
      >
        <template #header>
          <NFlex align="center" justify="space-between">
            <NText strong>
              OBS 控制 / 统计
            </NText>
            <NTooltip placement="bottom">
              <template #trigger>
                <NText
                  depth="3"
                  style="font-size: 12px; cursor: help;"
                >
                  使用说明
                </NText>
              </template>
              <div style="max-width: 260px;">
                <p style="margin: 0 0 8px;">
                  在 OBS 中开启 WebSocket：
                </p>
                <ol style="padding-left: 18px; margin: 0;">
                  <li>在 OBS 菜单中选择「工具 - WebSocket 服务器设置」</li>
                  <li>选择「开启 WebSocket 服务器」</li>
                  <li>服务器密码选择手动输入或点击「生成密码」自动生成，也可留空</li>
                  <li>点击「应用」</li>
                  <li>点击「显示连接信息」，记下端口与密码</li>
                </ol>
                <p style="margin: 8px 0 0;">
                  在上方输入对应的连接信息，点击「连接」即可
                </p>
              </div>
            </NTooltip>
          </NFlex>
        </template>
        <NFlex
          vertical
          gap="medium"
        >
          <NFlex
            align="center"
            justify="space-between"
          >
            <NButton
              :type="obsStore.obsStreamActive ? 'error' : 'success'"
              :disabled="!obsStore.obsConnected"
              :loading="obsStore.isTogglingObsStream"
              @click="obsStore.handleObsToggleStream"
            >
              {{ obsStore.obsStreamActive ? '停止推流' : '开始推流' }}
            </NButton>

            <NTag
              v-if="obsStore.obsStreamReconnecting"
              type="warning"
              size="small"
            >
              重连中
            </NTag>
          </NFlex>

          <NFlex
            vertical
            gap="small"
          >
            <NInputGroup>
              <NInput
                v-model:value="obsStore.obsAddress"
                placeholder="OBS WebSocket 地址 (默认: ws://127.0.0.1:4455)"
                :disabled="obsStore.obsConnected"
              />
              <NInput
                v-model:value="obsStore.obsPassword"
                type="password"
                placeholder="OBS WebSocket 密码 (可选)"
                :disabled="obsStore.obsConnected"
                show-password-on="click"
              />
            </NInputGroup>

            <NFlex
              align="center"
              justify="space-between"
            >
              <NButton
                :type="obsStore.obsConnected ? 'default' : 'primary'"
                :loading="obsStore.obsConnecting"
                @click="() => {
                  console.log('OBS connect button clicked');
                  console.log('obsStore:', obsStore);
                  console.log('obsConnected:', obsStore.obsConnected, 'obsConnecting:', obsStore.obsConnecting);
                  if (obsStore.obsConnected) {
                    obsStore.handleObsDisconnect();
                  } else {
                    obsStore.handleObsConnect();
                  }
                }"
              >
                {{ obsStore.obsConnected ? '断开 OBS' : '连接 OBS' }}
              </NButton>

              <NTag
                :type="obsStore.obsConnected ? (obsStore.obsStreamActive ? 'success' : 'info') : 'default'"
                size="medium"
              >
                {{ obsStore.obsConnected ? (obsStore.obsStreamActive ? '已连接 · 正在推流' : '已连接') : '未连接' }}
              </NTag>
            </NFlex>

            <NAlert
              v-if="obsStore.obsError"
              type="error"
              size="small"
            >
              {{ obsStore.obsError }}
            </NAlert>
          </NFlex>

          <NGrid
            :cols="3"
            :x-gap="12"
            :y-gap="12"
            responsive="screen"
          >
            <NGi>
              <NStatistic label="码率">
                {{ obsStore.obsStats.bitrateKbps != null ? `${obsStore.obsStats.bitrateKbps.toFixed(0)} kbps` : '—' }}
              </NStatistic>
            </NGi>
            <NGi>
              <NStatistic label="帧率">
                {{ obsStore.obsStats.fps != null ? `${obsStore.obsStats.fps.toFixed(1)} fps` : '—' }}
              </NStatistic>
            </NGi>
            <NGi>
              <NStatistic label="丢帧（输出）">
                <NTooltip v-if="obsStore.obsStats.outputSkippedFrames != null && obsStore.obsStats.outputTotalFrames != null && obsStore.obsStats.outputTotalFrames > 0">
                  <template #trigger>
                    <span style="cursor: help;">
                      {{ ((obsStore.obsStats.outputSkippedFrames / obsStore.obsStats.outputTotalFrames) * 100).toFixed(2) }}%
                    </span>
                  </template>
                  {{ obsStore.obsStats.outputSkippedFrames }} / {{ obsStore.obsStats.outputTotalFrames }}
                </NTooltip>
                <template v-else>
                  —
                </template>
              </NStatistic>
            </NGi>
            <NGi>
              <NStatistic label="CPU 使用率">
                {{ obsStore.obsStats.cpuUsage != null ? `${obsStore.obsStats.cpuUsage.toFixed(1)} %` : '—' }}
              </NStatistic>
            </NGi>
            <NGi>
              <NStatistic label="内存使用">
                {{ obsStore.obsStats.memoryUsage != null ? `${obsStore.obsStats.memoryUsage.toFixed(0)} MB` : '—' }}
              </NStatistic>
            </NGi>
            <NGi>
              <NStatistic label="渲染跳帧">
                <NTooltip v-if="obsStore.obsStats.renderSkippedFrames != null && obsStore.obsStats.renderTotalFrames != null && obsStore.obsStats.renderTotalFrames > 0">
                  <template #trigger>
                    <span style="cursor: help;">
                      {{ ((obsStore.obsStats.renderSkippedFrames / obsStore.obsStats.renderTotalFrames) * 100).toFixed(2) }}%
                    </span>
                  </template>
                  {{ obsStore.obsStats.renderSkippedFrames }} / {{ obsStore.obsStats.renderTotalFrames }}
                </NTooltip>
                <template v-else>
                  —
                </template>
              </NStatistic>
            </NGi>
          </NGrid>

          <NText
            v-if="obsStore.obsError"
            type="error"
            depth="3"
            style="font-size: 12px;"
          >
            {{ obsStore.obsError }}
          </NText>

          <!-- OBS 场景控制 -->
          <NDivider style="margin: 16px 0;" />
          
          <NText strong style="margin-bottom: 12px; display: block;">
            OBS 场景控制
          </NText>
          
          <!-- 场景切换 -->
          <div style="margin-bottom: 16px;">
            <NFlex
              align="center"
              justify="space-between"
              style="margin-bottom: 8px;"
            >
              <NText strong>
                场景切换
              </NText>
              <NTag
                :type="obsStore.currentObsScene ? 'success' : 'default'"
                size="small"
              >
                当前：{{ obsStore.currentObsScene || '未连接' }}
              </NTag>
            </NFlex>
            
            <NFlex
              v-if="obsStore.obsScenes.length > 0"
              gap="small"
              style="margin-top: 8px;"
              wrap
            >
              <NTag
                v-for="scene in obsStore.obsScenes"
                :key="scene"
                :type="scene === obsStore.currentObsScene ? 'primary' : 'default'"
                :bordered="scene !== obsStore.currentObsScene"
                size="medium"
                style="cursor: pointer;"
                :loading="obsStore.isSwitchingScene"
                @click="() => {
                  if (!obsStore.isSwitchingScene && scene !== obsStore.currentObsScene) {
                    obsStore.switchToScene(scene)
                  }
                }"
              >
                {{ scene }}
              </NTag>
            </NFlex>
            <NEmpty
              v-else
              description="无可用场景"
              size="small"
              style="margin-top: 8px;"
            />
          </div>

          <!-- 场景配置 -->
          <NDivider style="margin: 8px 0;" />
          
          <NText strong>
            场景联动配置：
          </NText>
          
          <NFlex
            vertical
            gap="small"
            style="margin-top: 8px;"
          >
            <NFlex
              align="center"
              justify="space-between"
            >
              <NText>启用自动场景切换</NText>
              <NSwitch
                v-model:value="obsStore.obsSceneConfig.autoSwitchEnabled"
                @update:value="obsStore.saveSceneConfig"
              />
            </NFlex>
            
            <NFlex
              align="center"
              justify="space-between"
            >
              <div>
                <NText>开播下播后自动切换 OBS 推流状态</NText>
                <NText depth="3" style="font-size: 12px; display: block; margin-top: 2px;">
                  开播时自动开始推流，下播时自动停止推流
                </NText>
              </div>
              <NSwitch
                v-model:value="obsStore.obsSceneConfig.autoToggleStream"
                @update:value="obsStore.saveSceneConfig"
              />
            </NFlex>
          </NFlex>

          <template v-if="obsStore.obsSceneConfig.autoSwitchEnabled">
            <div style="margin-top: 12px;">
              <NText strong>
                开播场景：
              </NText>
              <NSelect
                v-model:value="obsStore.obsSceneConfig.startScene"
                :options="obsStore.obsScenes.map(scene => ({ label: scene, value: scene }))"
                placeholder="选择开播时自动切换的场景"
                :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
                style="margin-top: 0.5rem;"
                @update:value="obsStore.saveSceneConfig"
              />
            </div>

            <div style="margin-top: 12px;">
              <NText strong>
                下播场景：
              </NText>
              <NSelect
                v-model:value="obsStore.obsSceneConfig.stopScene"
                :options="obsStore.obsScenes.map(scene => ({ label: scene, value: scene }))"
                placeholder="选择下播时自动切换的场景"
                :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
                style="margin-top: 0.5rem;"
                @update:value="obsStore.saveSceneConfig"
              />
            </div>

            <div style="margin-top: 12px;">
              <NText strong>
                等待场景：
              </NText>
              <NSelect
                v-model:value="obsStore.obsSceneConfig.waitingScene"
                :options="obsStore.obsScenes.map(scene => ({ label: scene, value: scene }))"
                placeholder="选择等待直播时的场景（可选）"
                :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
                style="margin-top: 0.5rem;"
                @update:value="obsStore.saveSceneConfig"
              />
            </div>
          </template>

          <!-- 错误提示 -->
          <NAlert
            v-if="obsStore.obsSceneError"
            type="error"
            size="small"
            style="margin-top: 12px;"
          >
            {{ obsStore.obsSceneError }}
          </NAlert>

          <!-- 帮助提示 -->
          <NText
            depth="3"
            style="font-size: 12px; margin-top: 8px; display: block;"
          >
            配置场景联动后，开播/下播时会自动切换到对应的场景。请确保OBS中已创建相应的场景。
          </NText>
        </NFlex>
      </NCard>
    </NFlex>

    <!-- 人脸认证弹窗 -->
    <NModal
      v-model:show="showFaceAuthModal"
      preset="card"
      title="人脸认证"
      style="width: 400px;"
      :closable="true"
      @close="closeFaceAuthModal"
    >
      <NFlex
        vertical
        align="center"
        gap="large"
      >
        <NText>
          请使用B站APP扫描下方二维码进行人脸认证
        </NText>
        
        <div
          v-if="faceAuthQrCode"
          style="padding: 1rem; background: white; border-radius: 8px;"
        >
          <img
            :src="faceAuthQrCode"
            alt="人脸认证二维码"
            style="width: 200px; height: 200px;"
          >
        </div>

        <NText depth="3">
          认证完成后，请关闭此窗口并重新点击"开始直播"
        </NText>

        <NButton
          type="primary"
          @click="closeFaceAuthModal"
        >
          关闭
        </NButton>
      </NFlex>
    </NModal>
  </div>
</template>

<style scoped>
  .live-manage-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px 12px 24px;
  }

  .live-manage-card + .live-manage-card {
    margin-top: 8px;
  }
</style>
