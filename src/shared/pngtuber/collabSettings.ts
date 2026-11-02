export type CollabLayoutType = 'row' | 'grid' | 'column'
export type CollabAlignmentType = 'bottom' | 'center' | 'top'

export interface PngtuberCollabSettings {
  gap: number
  scale: number
  layout: CollabLayoutType
  alignment: CollabAlignmentType
  spotlight: boolean
  activeScale: number
  inactiveOpacity: number
  showNames: boolean
  showVolumeBar: boolean
  padding: number
}

export const DEFAULT_COLLAB_SETTINGS: Readonly<PngtuberCollabSettings> = Object.freeze({
  gap: 32,
  scale: 1.0,
  layout: 'row',
  alignment: 'bottom',
  spotlight: true,
  activeScale: 1.03,
  inactiveOpacity: 0.75,
  showNames: true,
  showVolumeBar: true,
  padding: 16,
})

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val)
  if (Number.isNaN(n) || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function asBoolean(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val
  return fallback
}

export function normalizeCollabSettings(raw: unknown): PngtuberCollabSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_COLLAB_SETTINGS }
  }
  const obj = raw as Record<string, unknown>

  const layout: CollabLayoutType = obj.layout === 'grid' || obj.layout === 'column' ? obj.layout : 'row'
  const alignment: CollabAlignmentType =
    obj.alignment === 'center' || obj.alignment === 'top' ? obj.alignment : 'bottom'

  return {
    gap: Math.round(clampNumber(obj.gap, 0, 200, DEFAULT_COLLAB_SETTINGS.gap)),
    scale: Number(clampNumber(obj.scale, 0.4, 2.0, DEFAULT_COLLAB_SETTINGS.scale).toFixed(2)),
    layout,
    alignment,
    spotlight: asBoolean(obj.spotlight, DEFAULT_COLLAB_SETTINGS.spotlight),
    activeScale: Number(clampNumber(obj.activeScale, 1.0, 1.25, DEFAULT_COLLAB_SETTINGS.activeScale).toFixed(2)),
    inactiveOpacity: Number(
      clampNumber(obj.inactiveOpacity, 0.2, 1.0, DEFAULT_COLLAB_SETTINGS.inactiveOpacity).toFixed(2),
    ),
    showNames: asBoolean(obj.showNames, DEFAULT_COLLAB_SETTINGS.showNames),
    showVolumeBar: asBoolean(obj.showVolumeBar, DEFAULT_COLLAB_SETTINGS.showVolumeBar),
    padding: Math.round(clampNumber(obj.padding, 0, 80, DEFAULT_COLLAB_SETTINGS.padding)),
  }
}
