import type { BlockNode, BlockVisibilityContext } from './schemaTypes'

export function isBlockVisible(block: BlockNode, context: BlockVisibilityContext) {
  const condition = block.visibility
  if (!condition) return true
  if (condition.liveState === 'live' && !context.isLive) return false
  if (condition.liveState === 'offline' && context.isLive) return false
  if (condition.device && condition.device !== context.device) return false
  if (condition.startsAt !== undefined && context.now < condition.startsAt) return false
  if (condition.endsAt !== undefined && context.now > condition.endsAt) return false
  return true
}
