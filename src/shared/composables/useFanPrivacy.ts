import { usePersistedStorage } from '@/shared/storage/persist'

/** 全局防露屏隐私模式（跨粉丝档案、日程管理与直播中控台同步持久化） */
const fanPrivacyMode = usePersistedStorage<boolean>('vtsuru:fan:privacy-mode', false)

export function useFanPrivacy() {
  function togglePrivacyMode() {
    fanPrivacyMode.value = !fanPrivacyMode.value
  }

  function formatBirthday(month?: number | null, day?: number | null, revealed = false): string {
    if (!month || !day) return ''
    if (fanPrivacyMode.value || !revealed) return '••月••日'
    return `${month}月${day}日`
  }

  function formatPrice(amount: number): string {
    if (fanPrivacyMode.value) return '¥••••'
    return `¥${amount.toFixed(0)}`
  }

  function maskSensitiveText(text?: string | null, placeholder = '已开启防露屏遮罩'): string {
    if (!text) return ''
    if (fanPrivacyMode.value) return placeholder
    return text
  }

  return {
    privacyMode: fanPrivacyMode,
    togglePrivacyMode,
    formatBirthday,
    formatPrice,
    maskSensitiveText,
  }
}
