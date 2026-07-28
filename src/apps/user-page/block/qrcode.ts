export const QR_CODE_LEVELS = ['L', 'M', 'Q', 'H'] as const
export type QrCodeLevel = typeof QR_CODE_LEVELS[number]

const QR_CODE_BYTE_LIMITS: Record<QrCodeLevel, number> = {
  L: 2800,
  M: 2200,
  Q: 1550,
  H: 1150,
}

export function hasQrCodeCapacity(content: string, level: QrCodeLevel): boolean {
  return new TextEncoder().encode(content).length <= QR_CODE_BYTE_LIMITS[level]
}
