<script setup lang="ts">
import {
  AudioWaveform,
  CloudUpload,
  Cookie,
  Gift,
  Layers,
  MessageSquare,
  Monitor,
  Play,
  Radio,
  RefreshCw,
  Smile,
  Sparkles,
  Square,
  Zap,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { checkUpdate } from '@/apps/client/data/initialize'
import { TriggerType } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useLiveRoutine } from '@/apps/client/store/useLiveRoutine'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useTranscription } from '@/apps/client/store/useTranscription'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { type CommandItem, useCommandPalette } from '@/shared/composables/useCommandPalette'
import { isTauri } from '@/shared/config'
import { useWebFetcher } from '@/store/useWebFetcher'

const TRIGGER_LABELS: Record<TriggerType, string> = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '上舰感谢',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC 感谢',
  [TriggerType.POINT_REDEEM]: '积分兑换',
}

const router = useRouter()
const { registerSource } = useCommandPalette()

const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const obsStore = useOBSStore()
const vtsStore = useVtsStore()
const autoActionStore = useAutoAction()
const liveRoutine = useLiveRoutine()
const transcriptionStore = useTranscription()

const clientDynamicItems = computed<CommandItem[]>(() => {
  const items: CommandItem[] = []

  // 1. 客户端快捷操作
  items.push({
    id: 'client-action-danmaku-window',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: danmakuWindow.isDanmakuWindowOpen ? '关闭弹幕机浮窗' : '开启弹幕机浮窗',
    description: '切换桌面弹幕机悬浮窗显示状态',
    badge: danmakuWindow.isDanmakuWindowOpen ? '运行中' : '未开启',
    keywords: ['danmaku', 'window', '浮窗', '弹幕机', '开关'],
    icon: MessageSquare,
    run: () => {
      if (danmakuWindow.isDanmakuWindowOpen) {
        danmakuWindow.closeWindow()
      } else {
        danmakuWindow.openWindow()
      }
    },
  })

  items.push({
    id: 'client-action-gift-window',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: giftWindow.isGiftWindowOpen ? '关闭礼物与排行浮窗' : '开启礼物与排行浮窗',
    description: '切换桌面礼物与舰队排行悬浮窗',
    badge: giftWindow.isGiftWindowOpen ? '运行中' : '未开启',
    keywords: ['gift', 'rank', '浮窗', '礼物', '排行', '开关'],
    icon: Gift,
    run: () => {
      if (giftWindow.isGiftWindowOpen) {
        giftWindow.closeWindow()
      } else {
        giftWindow.openWindow()
      }
    },
  })

  if (webfetcher.state === 'connected' || webfetcher.state === 'connecting') {
    items.push({
      id: 'client-action-stop-fetcher',
      group: '客户端快捷操作',
      scope: 'dynamic',
      label: '停止 EventFetcher 采集',
      description: `当前连接模式：${webfetcher.webfetcherType === 'direct' ? '直连' : '开放平台'}`,
      badge: webfetcher.state === 'connected' ? '运行中' : '连接中',
      keywords: ['fetcher', 'stop', '采集', '停止', '断开'],
      icon: CloudUpload,
      run: async () => {
        await webfetcher.Stop()
        toast.info('已停止 EventFetcher 采集')
      },
    })
  } else {
    items.push({
      id: 'client-action-start-fetcher',
      group: '客户端快捷操作',
      scope: 'dynamic',
      label: '前往启动 EventFetcher 采集',
      description: '当前采集端未连接，跳转至采集配置页',
      badge: '未连接',
      keywords: ['fetcher', 'start', '采集', '启动'],
      icon: CloudUpload,
      run: () => router.push({ name: 'client-fetcher' }),
    })
  }

  items.push({
    id: 'client-action-check-cookie',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: '校验 B站 Cookie 状态',
    description: biliCookie.hasBiliCookie ? '立即检测当前主账号 Cookie 有效性' : '尚未同步 B站 Cookie',
    badge: !biliCookie.hasBiliCookie ? '未同步' : biliCookie.isCookieValid ? '正常' : '已失效',
    keywords: ['cookie', 'bili', '刷新', '校验', '账号'],
    icon: Cookie,
    run: async () => {
      if (!biliCookie.hasBiliCookie) {
        void router.push({ name: 'client-account-manage' })
        return
      }
      await biliCookie.check()
      if (biliCookie.isCookieValid) {
        toast.success('B站 Cookie 状态有效')
      } else {
        toast.warning('B站 Cookie 已失效，请前往重新扫码')
      }
    },
  })

  items.push({
    id: 'client-action-transcription-toggle',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: transcriptionStore.status.running ? '停止实时语音转写' : '启动实时语音转写',
    description: '控制客户端本地实时字幕转写服务',
    badge: transcriptionStore.status.running ? '运行中' : '未运行',
    keywords: ['asr', 'transcription', '语音', '转写', '字幕'],
    icon: AudioWaveform,
    run: async () => {
      if (transcriptionStore.status.running) {
        await transcriptionStore.stop()
      } else {
        await transcriptionStore.start()
      }
    },
  })

  items.push({
    id: 'client-action-start-routine',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: '执行一键开播编排',
    description: '按配置顺序启动 VTS/OBS、切换场景与打开浮窗',
    badge: liveRoutine.runningMode === 'start' ? '执行中' : '开播',
    keywords: ['routine', 'start', '开播', '编排', '一键'],
    icon: Play,
    run: () => liveRoutine.executeStartRoutine(),
  })

  items.push({
    id: 'client-action-stop-routine',
    group: '客户端快捷操作',
    scope: 'dynamic',
    label: '执行下播收尾编排',
    description: '按配置停止推流/转写并还原 VTS 状态',
    badge: liveRoutine.runningMode === 'stop' ? '执行中' : '下播',
    keywords: ['routine', 'stop', '下播', '收尾', '编排'],
    icon: Square,
    run: () => liveRoutine.executeStopRoutine(),
  })

  if (isTauri()) {
    items.push({
      id: 'client-action-check-update',
      group: '客户端快捷操作',
      scope: 'dynamic',
      label: '检查桌面客户端更新',
      description: '检测并拉取最新桌面端安装包',
      keywords: ['update', 'upgrade', '更新', '版本'],
      icon: RefreshCw,
      run: () => checkUpdate(true),
    })
  }

  // 2. 动态 OBS 场景与控制
  if (obsStore.obsConnected) {
    items.push({
      id: 'obs-action-stream',
      group: 'OBS 场景与控制',
      scope: 'dynamic',
      label: obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流',
      description: '切换 OBS 当前推流状态',
      badge: obsStore.obsStreamActive ? '推流中' : '未推流',
      keywords: ['obs', 'stream', '推流', '开播', '下播'],
      icon: Radio,
      run: () => obsStore.handleObsToggleStream(),
    })

    items.push({
      id: 'obs-action-replay',
      group: 'OBS 场景与控制',
      scope: 'dynamic',
      label: obsStore.obsReplayBufferActive ? '关闭 OBS 回放缓存' : '开启 OBS 回放缓存',
      description: '切换 OBS Replay Buffer 状态',
      badge: obsStore.obsReplayBufferActive ? '已开启' : '未开启',
      keywords: ['obs', 'replay', '回放', '录制'],
      icon: Monitor,
      run: () => obsStore.toggleReplayBuffer(),
    })

    for (const sceneName of obsStore.obsScenes) {
      const isCurrent = sceneName === obsStore.currentObsScene
      items.push({
        id: `obs-scene-${sceneName}`,
        group: 'OBS 场景与控制',
        scope: 'dynamic',
        label: `切换 OBS 场景：${sceneName}`,
        description: isCurrent ? '当前活动场景' : '点击立即切换至该场景',
        badge: isCurrent ? '当前' : '场景',
        keywords: ['obs', 'scene', '场景', '切场', sceneName],
        icon: Layers,
        run: () => obsStore.switchToScene(sceneName),
      })
    }
  }

  // 3. 动态 VTS 控制（连接态下提供实时热键/表情/模型，离线也保留本地预设/宏/配置方案）
  if (vtsStore.connected) {
    items.push({
      id: 'vts-action-clear-expressions',
      group: 'VTS 动态控制',
      scope: 'dynamic',
      label: '清除 VTS 当前激活表情',
      description: '关闭当前模型所有激活中的表情',
      keywords: ['vts', 'clear', 'expression', '清除', '表情'],
      icon: Smile,
      run: () => vtsStore.clearExpressions(),
    })

    for (const hk of vtsStore.hotkeys) {
      const displayName = vtsStore.hotkeyCustomizations.find((c) => c.hotkeyID === hk.hotkeyID)?.displayName || hk.name
      items.push({
        id: `vts-hotkey-${hk.hotkeyID}`,
        group: 'VTS 动态控制',
        scope: 'dynamic',
        label: displayName,
        description: `触发 VTS 热键 · ${hk.type}`,
        badge: '热键',
        keywords: ['vts', 'hotkey', '热键', displayName, hk.name, hk.type],
        icon: Smile,
        run: () => vtsStore.triggerHotkey(hk.hotkeyID),
      })
    }

    for (const exp of vtsStore.expressions) {
      items.push({
        id: `vts-expr-${exp.file}`,
        group: 'VTS 动态控制',
        scope: 'dynamic',
        label: exp.name || exp.file,
        description: exp.active ? '当前已激活，点击关闭该表情' : '点击激活该 VTS 表情',
        badge: exp.active ? '已激活' : '表情',
        keywords: ['vts', 'expression', '表情', exp.name, exp.file],
        icon: Sparkles,
        run: () => vtsStore.toggleExpression(exp.file),
      })
    }

    for (const model of vtsStore.availableModels) {
      items.push({
        id: `vts-model-${model.modelID}`,
        group: 'VTS 动态控制',
        scope: 'dynamic',
        label: `切换模型：${model.modelName}`,
        description: model.modelLoaded ? '当前已加载模型' : '点击加载该 VTS 模型',
        badge: model.modelLoaded ? '当前' : '模型',
        keywords: ['vts', 'model', '模型', model.modelName, model.vtsModelName],
        icon: Smile,
        run: () => vtsStore.loadModel(model.modelID),
      })
    }
  }

  for (const preset of vtsStore.presets) {
    items.push({
      id: `vts-preset-${preset.id}`,
      group: 'VTS 动态控制',
      scope: 'dynamic',
      label: `机位预设：${preset.name}`,
      description: vtsStore.connected ? '立即应用该 VTS 机位变换' : 'VTS 未连接，点击前往 VTS 控制页',
      badge: '预设',
      keywords: ['vts', 'preset', '机位', '预设', preset.name],
      icon: Smile,
      run: () => {
        if (!vtsStore.connected) {
          toast.warning('VTS 尚未连接')
          void router.push({ name: 'client-vts' })
          return
        }
        return vtsStore.applyPreset(preset.id)
      },
    })
  }

  for (const macro of vtsStore.macros) {
    items.push({
      id: `vts-macro-${macro.id}`,
      group: 'VTS 动态控制',
      scope: 'dynamic',
      label: `动作宏：${macro.name}`,
      description: vtsStore.connected
        ? `共 ${macro.steps.length} 个步骤，点击立即执行`
        : 'VTS 未连接，点击前往 VTS 控制页',
      badge: '宏',
      keywords: ['vts', 'macro', '动作宏', '宏', macro.name],
      icon: Smile,
      run: () => {
        if (!vtsStore.connected) {
          toast.warning('VTS 尚未连接')
          void router.push({ name: 'client-vts' })
          return
        }
        return vtsStore.runMacro(macro.id)
      },
    })
  }

  for (const profile of vtsStore.profiles) {
    const isActive = profile.id === vtsStore.currentProfileId
    items.push({
      id: `vts-profile-${profile.id}`,
      group: 'VTS 动态控制',
      scope: 'dynamic',
      label: `VTS 配置方案：${profile.name}`,
      description: isActive ? '当前生效的配置方案' : '切换并应用该配置方案',
      badge: isActive ? '当前' : '方案',
      keywords: ['vts', 'profile', '配置方案', profile.name],
      icon: Smile,
      run: () => vtsStore.applyProfile(profile.id),
    })
  }

  // 4. 动态自动操作规则
  for (const action of autoActionStore.autoActions) {
    const triggerLabel = TRIGGER_LABELS[action.triggerType] ?? action.triggerType
    const ruleKeywords = action.triggerConfig?.keywords ?? []
    const descParts = [triggerLabel]
    if (ruleKeywords.length > 0) {
      descParts.push(`关键词: ${ruleKeywords.slice(0, 3).join(', ')}`)
    } else if (action.description) {
      descParts.push(action.description)
    }
    items.push({
      id: `auto-action-rule-${action.id}`,
      group: '自动操作规则',
      scope: 'dynamic',
      label: action.name || '未命名规则',
      description: descParts.join(' · '),
      badge: action.enabled ? '已启用' : '已停用',
      keywords: [
        'auto',
        'rule',
        '自动操作',
        '规则',
        triggerLabel,
        action.name,
        action.description ?? '',
        action.template ?? '',
        ...ruleKeywords,
      ].filter(Boolean),
      icon: Zap,
      run: () =>
        router.push({
          name: 'client-auto-action-manage',
          query: { tab: action.triggerType, edit: action.id },
        }),
    })
  }

  return items
})

let unregister: (() => void) | null = null

onMounted(() => {
  unregister = registerSource('client-dynamic', () => clientDynamicItems.value)
})

onBeforeUnmount(() => {
  unregister?.()
  unregister = null
})
</script>

<template>
  <!-- 无渲染动态命令源注册组件 -->
  <span class="hidden" />
</template>
