import { useIntervalFn } from '@vueuse/core'
import { computed, onActivated, onDeactivated, ref, shallowRef } from 'vue'

import type { RequestCreateBulletVote, ResponseVoteSession, VoteOptionDto } from '@/api/api-models'
import * as voteApi from '@/api/vote'
import { getVoteStandings } from '@/shared/utils/voteStandings'

const POLL_MS = 2000

/** 投票面板状态：挂载期间轮询进行中的投票；结束后保留最终结果直到发起新投票 */
export function useDashboardVote() {
  const session = shallowRef<ResponseVoteSession | null>(null)
  const loaded = ref(false)
  const busy = ref(false)
  const pollError = ref<string>()

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

  const { pause, resume } = useIntervalFn(() => void refresh(), POLL_MS, { immediateCallback: true })
  // 客户端内页面被 KeepAlive 缓存，离开时停止轮询
  onDeactivated(pause)
  onActivated(resume)

  async function run(action: () => Promise<ResponseVoteSession>, success: string) {
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

  const options = computed<VoteOptionDto[]>(() =>
    (session.value?.options ?? []).map((option, index) => ({
      index: index + 1,
      text: option.text,
      count: option.count,
      percentage: session.value?.totalVotes ? (option.count / session.value.totalVotes) * 100 : 0,
    })),
  )
  const standings = computed(() => getVoteStandings(options.value))

  return {
    session,
    loaded,
    busy,
    pollError,
    options,
    standings,
    create: async (payload: RequestCreateBulletVote) => run(async () => voteApi.createVote(payload), '投票已发起'),
    extend: async (seconds: number) => run(async () => voteApi.extendVote(seconds), `已延长 ${seconds} 秒`),
    end: async (id: number) => run(async () => voteApi.endVote(id), '投票已结束'),
  }
}
