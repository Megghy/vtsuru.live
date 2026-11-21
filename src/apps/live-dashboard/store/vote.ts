import { useIntervalFn } from '@vueuse/core'
import { computed, onActivated, onDeactivated, ref, shallowRef } from 'vue'

import * as voteApi from '@/api/vote'
import {
  createDefaultVoteConfig,
  type CreateVotePayload,
  type VoteConfigModel,
  type VoteOptionDtoModel,
  VoteResultMode,
  type VoteSessionModel,
} from '@/api/vote'
import { useVoteDanmakuBridge } from '@/composables/useVoteDanmakuBridge'
import { getVoteStandings } from '@/shared/utils/voteStandings'

const POLL_MS = 2000

/** 投票面板状态：挂载期间轮询进行中的投票；结束后保留最终结果直到发起新投票 */
export function useDashboardVote() {
  const session = shallowRef<VoteSessionModel | null>(null)
  const config = ref<VoteConfigModel>(createDefaultVoteConfig())
  const loaded = ref(false)
  const busy = ref(false)
  const pollError = ref<string>()
  const isActivated = ref(true)

  async function loadConfig() {
    try {
      config.value = await voteApi.getVoteConfig()
    } catch {
      // 忽略中控台配置首拉异常，使用默认值
    }
  }

  async function refresh() {
    try {
      const active = await voteApi.getActiveVote()
      // 进行中的投票被倒计时或主播弹幕结束：拉一次历史拿到最终票数
      if (!active && session.value?.isActive) {
        const [latest] = await voteApi.getVoteHistory(1)
        session.value = latest?.id === session.value.id ? latest : { ...session.value, isActive: false }
      } else if (active || !loaded.value) {
        session.value = active ?? (await voteApi.getVoteHistory(1))[0] ?? null
      }
      pollError.value = undefined
    } catch (error) {
      pollError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loaded.value = true
    }
  }

  void loadConfig()

  useVoteDanmakuBridge(session, {
    config,
    enabled: isActivated,
    onUpdate: (status, updated) => {
      if (status === 'ended') {
        void refresh()
      } else if (updated) {
        session.value = updated
      }
    },
  })

  const { pause, resume } = useIntervalFn(() => void refresh(), POLL_MS, { immediateCallback: true })
  // 客户端内页面被 KeepAlive 缓存，离开时停止轮询
  onDeactivated(() => {
    isActivated.value = false
    pause()
  })
  onActivated(() => {
    isActivated.value = true
    resume()
  })

  async function run(action: () => Promise<VoteSessionModel>, success: string) {
    busy.value = true
    try {
      session.value = await action()
      window.$message.success(success)
    } catch (error) {
      window.$message.error(error instanceof Error ? error.message : String(error))
    } finally {
      busy.value = false
    }
  }

  const options = computed<VoteOptionDtoModel[]>(() => {
    const totalVotes = session.value?.totalVotes ?? 0
    const totalContrib = session.value?.totalContribution ?? 0
    const useContrib = config.value.voteResultMode === VoteResultMode.ByContribution && totalContrib > 0
    return (session.value?.options ?? []).map((option, index) => ({
      index: index + 1,
      text: option.text,
      count: option.count,
      contribution: option.contribution ?? 0,
      percentage: useContrib
        ? ((option.contribution ?? 0) / totalContrib) * 100
        : totalVotes > 0
          ? (option.count / totalVotes) * 100
          : 0,
    }))
  })

  const standings = computed(() =>
    getVoteStandings(options.value, config.value.voteResultMode, session.value?.winnerOverride),
  )

  return {
    session,
    config,
    loaded,
    busy,
    pollError,
    options,
    standings,
    create: async (payload: CreateVotePayload) => run(async () => voteApi.createVote(payload), '投票已发起'),
    extend: async (seconds: number) => run(async () => voteApi.extendVote(seconds), `已延长 ${seconds} 秒`),
    pauseVote: async () => run(async () => voteApi.pauseVote(), '投票已暂停'),
    resumeVote: async () => run(async () => voteApi.resumeVote(), '投票已恢复'),
    tiebreakDraw: async (sessionId?: number) => {
      busy.value = true
      try {
        const res = await voteApi.tiebreakDraw(sessionId)
        session.value = res.session
        window.$message.success(res.winner ? `抽签胜出：${res.winner}` : '平票抽签已完成')
      } catch (error) {
        window.$message.error(error instanceof Error ? error.message : String(error))
      } finally {
        busy.value = false
      }
    },
    tiebreakOvertime: async (seconds = 60) =>
      run(async () => voteApi.tiebreakOvertime(seconds), `已开启 ${seconds} 秒平票加时赛`),
    end: async (id: number) => run(async () => voteApi.endVote(id), '投票已结束'),
  }
}
