import { usePngtuberDriver } from '../../usePngtuberDriver'
import type { AutoActionItem } from '../types'

export async function executePngtuberExpression(action: AutoActionItem) {
  const { pngtuberExpressionId, pngtuberDurationMs = 5000, pngtuberChannel = 'default' } = action.actionConfig
  if (!pngtuberExpressionId?.trim()) throw new Error('请指定 PNGtuber 表情 ID')
  await usePngtuberDriver().switchExpression(
    pngtuberExpressionId.trim(),
    pngtuberDurationMs ?? 5000,
    pngtuberChannel.trim() || 'default',
  )
}
