type UmamiValue = string | number | boolean | null
type UmamiData = Record<string, UmamiValue | undefined>

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, UmamiValue>) => void
    }
  }
}

export function trackManageToolSuccess(tool: string, action: string, data: UmamiData = {}) {
  if (typeof window === 'undefined') return

  const eventData: Record<string, UmamiValue> = { tool, action }
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) eventData[key] = value
  }

  window.umami?.track('Manage Tool Success', eventData)
}
