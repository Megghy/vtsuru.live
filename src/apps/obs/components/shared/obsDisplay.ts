export type ObsDisplayTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'

export interface ObsDisplayBadge {
  text: string
  tone?: ObsDisplayTone
}

export interface ObsDisplayMember {
  id: number | string
  name: string
  subtitle?: string
}

export interface ObsDisplayCurrent {
  active: boolean
  title?: string
  subtitle?: string
  avatarUrl?: string
  hideAvatar?: boolean
  emptyText: string
  badges?: ObsDisplayBadge[]
  members?: ObsDisplayMember[]
}

export interface ObsDisplayItem {
  id: number | string
  primary: string
  secondary?: string
  badges?: ObsDisplayBadge[]
}

export interface ObsDisplayFooterTag {
  type: string
  label: string
  value: string
}
