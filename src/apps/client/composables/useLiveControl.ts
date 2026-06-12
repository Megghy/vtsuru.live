import { ref, computed, watch, onMounted } from 'vue'
import {
  startLive,
  stopLive,
  updateRoom,
  getLiveAreas,
  getLiveVersion,
  updateRoomNews,
} from '@/apps/client/api/live-manage'
import type { LiveArea } from '@/apps/client/api/live-manage'
import { useAccount } from '@/api/account'
import { roomInfo } from '@/apps/client/data/info'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useLiveCover } from './useLiveCover'

interface RtmpInfoState {
  server: string
  code: string
}

const RTMP_INFO_KEY = 'webfetcher.rtmpInfo'

/**
 * 直播控制 composable: 集中管理开播/停播/房间设置/公告/封面/推流码等状态与逻辑。
 * 在页面容器中调用一次, 将返回对象作为 prop 传递给各子组件。
 */
export function useLiveControl() {
  const accountInfo = useAccount()
  const obsStore = useOBSStore()
  const tauriStore = useTauriStore()
  const cover = useLiveCover()

  // 直播状态
  const isLiving = ref(false)
  const rtmpServer = ref('')
  const rtmpCode = ref('')

  // 直播设置
  const liveAreaId = ref(0)
  const liveTitle = ref('')
  const hasEditedTitle = ref(false)
  const hasEditedArea = ref(false)
  const roomAnnouncement = ref('')
  const liveAreas = ref<LiveArea[]>([])
  const isUpdatingAnnouncement = ref(false)

  // 人脸认证
  const faceAuthQrCode = ref('')
  const showFaceAuthModal = ref(false)

  // 直播姬版本信息
  const liveVersionInfo = ref<{ version: string; build: number } | null>(null)

  const areaOptions = computed(() => {
    const parentMap = new Map<number, { label: string; value: number; children: { label: string; value: number }[] }>()
    liveAreas.value.forEach(area => {
      if (!parentMap.has(area.parent_id)) {
        parentMap.set(area.parent_id, {
          label: area.parent_name,
          value: area.parent_id,
          children: [],
        })
      }
      parentMap.get(area.parent_id)!.children.push({
        label: area.name,
        value: area.id,
      })
    })
    return Array.from(parentMap.values())
  })

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

  const loadLiveAreas = async () => {
    try {
      liveAreas.value = await getLiveAreas()
    }
    catch (err) {
      console.error('加载直播分区失败:', err)
      window.$message.error('加载直播分区失败')
    }
  }

  // 获取直播姬版本号
  const fetchLiveVersion = async () => {
    const versionInfo = await getLiveVersion()
    if (versionInfo) {
      liveVersionInfo.value = {
        version: versionInfo.curr_version,
        build: versionInfo.build,
      }
    }
  }

  const markTitleEdited = () => {
    hasEditedTitle.value = true
  }

  const markAreaEdited = () => {
    hasEditedArea.value = true
  }

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

  // __LIVE_METHODS__
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

  // __LIVE_METHODS2__
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

  // 关闭人脸认证弹窗
  const closeFaceAuthModal = () => {
    showFaceAuthModal.value = false
    faceAuthQrCode.value = ''
  }

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
    await loadLiveAreas()
    await fetchLiveVersion() // 获取直播姬版本号

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

  return {
    ...cover,
    obsStore,
    isLiving,
    rtmpServer,
    rtmpCode,
    liveAreaId,
    liveTitle,
    roomAnnouncement,
    liveAreas,
    isUpdatingAnnouncement,
    faceAuthQrCode,
    showFaceAuthModal,
    areaOptions,
    titleChanged,
    areaChanged,
    needUpdateBeforeLive,
    handleUpdateAnnouncement,
    markTitleEdited,
    markAreaEdited,
    handleStartLive,
    handleStartLiveWithUpdate,
    handleStopLive,
    handleUpdateRoom,
    closeFaceAuthModal,
    copyToClipboard,
    handleSyncStreamKeyToObs,
  }
}

export type LiveControl = ReturnType<typeof useLiveControl>
