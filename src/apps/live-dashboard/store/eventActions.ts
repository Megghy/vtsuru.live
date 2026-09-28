import { AddBiliBlackList, DelBiliBlackList, isInBiliBlackList } from '@/api/account'
import type { APIRoot } from '@/api/api-models'
import { useTranslate } from '@/composables/useTranslate'
import { useSpeechService } from '@/store/useSpeechService'

import type { DashboardEvent } from '../core/types'
import { toEventModel } from '../core/types'
import { useDashboardUi } from './ui'

function report(resp: APIRoot<unknown>, success: string) {
  if (resp.code === 200) window.$message.success(success)
  else window.$message.error(resp.message)
}

/** 右键菜单与用户菜单共用的事件操作，结果在此统一提示 */
export function useEventActions() {
  const ui = useDashboardUi()
  const speech = useSpeechService()
  const translator = useTranslate()
  translator.targetLang.value = 'zh'

  const isBlocked = (event: DashboardEvent) => isInBiliBlackList(event.ouid)

  function toggleBlock(event: DashboardEvent) {
    if (isBlocked(event)) {
      void DelBiliBlackList(event.ouid).then((resp) => report(resp, `已将 ${event.uname} 移出黑名单`))
      return
    }
    window.$dialog.warning({
      title: '加入黑名单',
      content: `确定拉黑 ${event.uname}？拉黑后该用户无法参与排队、点歌等弹幕互动。`,
      positiveText: '拉黑',
      negativeText: '取消',
      onPositiveClick: async () => report(await AddBiliBlackList(event.ouid, event.uname), `已拉黑 ${event.uname}`),
    })
  }

  /** 插到读弹幕队列最前，未开启读弹幕监听时也会朗读这一条 */
  async function speak(event: DashboardEvent) {
    await speech.initialize()
    if (speech.speechState.isInitialized) speech.forceSpeak(toEventModel(event))
  }

  async function translate(event: DashboardEvent) {
    try {
      ui.translations.set(event.key, await translator.translate(event.msg))
    } catch (error) {
      window.$message.error(`翻译失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { isBlocked, toggleBlock, speak, translate }
}
