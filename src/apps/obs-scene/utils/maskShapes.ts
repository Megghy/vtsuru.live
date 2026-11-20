export type ObsLayerMaskShape =
  | 'none'
  | 'circle'
  | 'ellipse'
  | 'pill'
  | 'chamfer'
  | 'cut-diagonal'
  | 'diamond'
  | 'hexagon'
  | 'octagon'
  | 'triangle'
  | 'parallelogram'
  | 'arch'
  | 'star'
  | 'heart'

export interface MaskShapePreset {
  id: ObsLayerMaskShape
  label: string
  /** 24×24 预览图标用的 SVG path */
  previewPath: string
  /** 是否支持圆角/切角数值微调 */
  supportsRadius: boolean
  /** 数值字段标题 */
  radiusLabel?: string
  /** 从无圆角切换至该形状时的默认圆角/切角像素值 */
  defaultRadius?: number
}

export const MASK_SHAPE_PRESETS: MaskShapePreset[] = [
  {
    id: 'none',
    label: '矩形',
    previewPath: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    supportsRadius: true,
    radiusLabel: '圆角大小 (px)',
  },
  {
    id: 'circle',
    label: '正圆',
    previewPath: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z',
    supportsRadius: false,
  },
  {
    id: 'ellipse',
    label: '椭圆',
    previewPath: 'M12 5a10 7 0 1 1 0 14a10 7 0 1 1 0-14Z',
    supportsRadius: false,
  },
  {
    id: 'pill',
    label: '胶囊',
    previewPath: 'M8 6h8a6 6 0 0 1 0 12H8a6 6 0 0 1 0-12Z',
    supportsRadius: false,
  },
  {
    id: 'chamfer',
    label: '四角切角',
    previewPath: 'M7 3h10l4 4v10l-4 4H7l-4-4V7Z',
    supportsRadius: true,
    radiusLabel: '切角大小 (px)',
    defaultRadius: 24,
  },
  {
    id: 'cut-diagonal',
    label: '对角切角',
    previewPath: 'M8 3h13v13l-5 5H3V8Z',
    supportsRadius: true,
    radiusLabel: '切角大小 (px)',
    defaultRadius: 32,
  },
  {
    id: 'diamond',
    label: '菱形',
    previewPath: 'M12 2L22 12L12 22L2 12Z',
    supportsRadius: false,
  },
  {
    id: 'hexagon',
    label: '六边形',
    previewPath: 'M7 3h10l5 9-5 9H7L2 12Z',
    supportsRadius: false,
  },
  {
    id: 'octagon',
    label: '八边形',
    previewPath: 'M8 2h8l6 6v8l-6 6H8l-6-6V8Z',
    supportsRadius: false,
  },
  {
    id: 'parallelogram',
    label: '斜切框',
    previewPath: 'M6 4h16l-4 16H2Z',
    supportsRadius: false,
  },
  {
    id: 'arch',
    label: '拱形窗',
    previewPath: 'M4 11a8 8 0 0 1 16 0v10H4Z',
    supportsRadius: true,
    radiusLabel: '底角圆角 (px)',
  },
  {
    id: 'triangle',
    label: '三角形',
    previewPath: 'M12 3L22 21H2Z',
    supportsRadius: false,
  },
  {
    id: 'star',
    label: '五角星',
    previewPath: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8Z',
    supportsRadius: false,
  },
  {
    id: 'heart',
    label: '心形',
    previewPath: 'M12 21S3 14.8 3 8.5A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.5C21 14.8 12 21 12 21Z',
    supportsRadius: false,
  },
]

const MASK_SHAPE_ID_SET = new Set<string>(MASK_SHAPE_PRESETS.map((item) => item.id))

export function normalizeMaskShape(raw: unknown): ObsLayerMaskShape {
  if (typeof raw === 'string' && MASK_SHAPE_ID_SET.has(raw)) {
    return raw as ObsLayerMaskShape
  }
  return 'none'
}

export function getMaskShapePreset(shape?: ObsLayerMaskShape): MaskShapePreset {
  return MASK_SHAPE_PRESETS.find((item) => item.id === shape) ?? MASK_SHAPE_PRESETS[0]
}

function fmt(n: number): string {
  return Number.isFinite(n) ? Number(n.toFixed(2)).toString() : '0'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function buildRoundedRectPath(w: number, h: number, radius: number): string {
  const r = clamp(radius, 0, Math.min(w, h) / 2)
  if (r <= 0) {
    return `M0 0 H${fmt(w)} V${fmt(h)} H0 Z`
  }
  return [
    `M${fmt(r)} 0`,
    `H${fmt(w - r)}`,
    `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(w)} ${fmt(r)}`,
    `V${fmt(h - r)}`,
    `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(w - r)} ${fmt(h)}`,
    `H${fmt(r)}`,
    `A${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(h - r)}`,
    `V${fmt(r)}`,
    `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} 0`,
    'Z',
  ].join(' ')
}

/**
 * 按图层实际像素尺寸生成精确 SVG Path，供外层 clip-path 与装饰框等宽内描边共用。
 * 返回空字符串表示 'none'（标准矩形，直接走原生 CSS border-radius）。
 */
export function buildMaskShapePath(
  shape: ObsLayerMaskShape | undefined,
  width: number,
  height: number,
  radius = 0,
): string {
  if (!shape || shape === 'none') return ''
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : 0)

  switch (shape) {
    case 'circle': {
      const r = Math.min(w, h) / 2
      const cx = w / 2
      const cy = h / 2
      return `M${fmt(cx)} ${fmt(cy - r)} A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx)} ${fmt(cy + r)} A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx)} ${fmt(cy - r)} Z`
    }

    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      const cx = w / 2
      return `M${fmt(cx)} 0 A${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx)} ${fmt(h)} A${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx)} 0 Z`
    }

    case 'pill': {
      return buildRoundedRectPath(w, h, Math.min(w, h) / 2)
    }

    case 'chamfer': {
      const c = clamp(safeRadius, 0, Math.min(w, h) / 2)
      if (c <= 0) return `M0 0 H${fmt(w)} V${fmt(h)} H0 Z`
      return `M${fmt(c)} 0 L${fmt(w - c)} 0 L${fmt(w)} ${fmt(c)} L${fmt(w)} ${fmt(h - c)} L${fmt(w - c)} ${fmt(h)} L${fmt(c)} ${fmt(h)} L0 ${fmt(h - c)} L0 ${fmt(c)} Z`
    }

    case 'cut-diagonal': {
      const c = clamp(safeRadius, 0, Math.min(w, h) * 0.48)
      if (c <= 0) return `M0 0 H${fmt(w)} V${fmt(h)} H0 Z`
      return `M${fmt(c)} 0 L${fmt(w)} 0 L${fmt(w)} ${fmt(h - c)} L${fmt(w - c)} ${fmt(h)} L0 ${fmt(h)} L0 ${fmt(c)} Z`
    }

    case 'diamond': {
      return `M${fmt(w / 2)} 0 L${fmt(w)} ${fmt(h / 2)} L${fmt(w / 2)} ${fmt(h)} L0 ${fmt(h / 2)} Z`
    }

    case 'hexagon': {
      const dx = Math.min(w * 0.25, h * 0.5)
      return `M${fmt(dx)} 0 L${fmt(w - dx)} 0 L${fmt(w)} ${fmt(h / 2)} L${fmt(w - dx)} ${fmt(h)} L${fmt(dx)} ${fmt(h)} L0 ${fmt(h / 2)} Z`
    }

    case 'octagon': {
      const dx = w * 0.2929
      const dy = h * 0.2929
      return `M${fmt(dx)} 0 L${fmt(w - dx)} 0 L${fmt(w)} ${fmt(dy)} L${fmt(w)} ${fmt(h - dy)} L${fmt(w - dx)} ${fmt(h)} L${fmt(dx)} ${fmt(h)} L0 ${fmt(h - dy)} L0 ${fmt(dy)} Z`
    }

    case 'triangle': {
      return `M${fmt(w / 2)} 0 L${fmt(w)} ${fmt(h)} L0 ${fmt(h)} Z`
    }

    case 'parallelogram': {
      const skew = Math.min(w * 0.22, h * 0.45)
      return `M${fmt(skew)} 0 L${fmt(w)} 0 L${fmt(w - skew)} ${fmt(h)} L0 ${fmt(h)} Z`
    }

    case 'arch': {
      const rx = w / 2
      const ry = Math.min(w / 2, h * 0.55)
      const br = clamp(safeRadius, 0, Math.min(w / 2, Math.max(0, h - ry)))
      if (br <= 0) {
        return `M0 ${fmt(ry)} A${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(w)} ${fmt(ry)} L${fmt(w)} ${fmt(h)} L0 ${fmt(h)} Z`
      }
      return [
        `M0 ${fmt(ry)}`,
        `A${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(w)} ${fmt(ry)}`,
        `L${fmt(w)} ${fmt(h - br)}`,
        `A${fmt(br)} ${fmt(br)} 0 0 1 ${fmt(w - br)} ${fmt(h)}`,
        `L${fmt(br)} ${fmt(h)}`,
        `A${fmt(br)} ${fmt(br)} 0 0 1 0 ${fmt(h - br)}`,
        'Z',
      ].join(' ')
    }

    case 'star': {
      const pts: Array<{ x: number; y: number }> = []
      const outer = 1
      const inner = 0.382
      for (let i = 0; i < 10; i++) {
        const angle = (-90 + i * 36) * (Math.PI / 180)
        const r = i % 2 === 0 ? outer : inner
        pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
      }
      const minX = Math.min(...pts.map((p) => p.x))
      const maxX = Math.max(...pts.map((p) => p.x))
      const minY = Math.min(...pts.map((p) => p.y))
      const maxY = Math.max(...pts.map((p) => p.y))
      const spanX = maxX - minX
      const spanY = maxY - minY
      return (
        pts
          .map((p, idx) => {
            const x = ((p.x - minX) / spanX) * w
            const y = ((p.y - minY) / spanY) * h
            return `${idx === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`
          })
          .join(' ') + ' Z'
      )
    }

    case 'heart': {
      const sx = (v: number) => fmt((v / 100) * w)
      const sy = (v: number) => fmt((v / 100) * h)
      return [
        `M${sx(50)} ${sy(22)}`,
        `C${sx(50)} ${sy(2)}, ${sx(99)} ${sy(2)}, ${sx(99)} ${sy(34)}`,
        `C${sx(99)} ${sy(62)}, ${sx(68)} ${sy(82)}, ${sx(50)} ${sy(98)}`,
        `C${sx(32)} ${sy(82)}, ${sx(1)} ${sy(62)}, ${sx(1)} ${sy(34)}`,
        `C${sx(1)} ${sy(2)}, ${sx(50)} ${sy(2)}, ${sx(50)} ${sy(22)}`,
        'Z',
      ].join(' ')
    }
  }
}

export function buildMaskClipPath(
  shape: ObsLayerMaskShape | undefined,
  width: number,
  height: number,
  radius = 0,
): string | undefined {
  const path = buildMaskShapePath(shape, width, height, radius)
  return path ? `path('${path}')` : undefined
}
