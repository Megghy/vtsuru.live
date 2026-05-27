import { removeBackground, removeForeground, segmentForeground, preload, type Config } from '@imgly/background-removal'
import { reactive, ref } from 'vue'

export type ProcessMode = 'remove-bg' | 'remove-fg' | 'mask'
export type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export type DeviceType = 'cpu' | 'gpu'
export type ModelType = 'isnet' | 'isnet_fp16' | 'isnet_quint8'

export interface RemoveBgOptions {
  mode: ProcessMode
  model: ModelType
  device: DeviceType
  format: OutputFormat
  quality: number
  proxyToWorker: boolean
}

const STORAGE_KEY = 'remove-bg-options'

function defaultOptions(): RemoveBgOptions {
  return { mode: 'remove-bg', model: 'isnet_fp16', device: 'cpu', format: 'image/png', quality: 0.8, proxyToWorker: true }
}

function loadOptions(): RemoveBgOptions {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaultOptions(), ...JSON.parse(saved) }
  } catch {}
  return defaultOptions()
}

function saveOptions(opts: RemoveBgOptions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts))
}

const options = reactive<RemoveBgOptions>(loadOptions())
const supported = ref<boolean | null>(null)
const webgpuSupported = ref<boolean | null>(null)
const progress = ref<{ key: string; current: number; total: number } | null>(null)

export async function checkSupport(): Promise<boolean> {
  if (supported.value !== null) return supported.value
  supported.value = typeof WebAssembly !== 'undefined'
  webgpuSupported.value = !!(navigator as any).gpu
  if (options.device === 'gpu' && !webgpuSupported.value) options.device = 'cpu'
  return supported.value
}

function buildConfig(): Config {
  return {
    model: options.model,
    device: options.device,
    proxyToWorker: options.proxyToWorker,
    output: { format: options.format, quality: options.quality },
    progress: (key, current, total) => {
      progress.value = { key, current, total }
    },
  }
}

export async function preloadModel() {
  saveOptions(options)
  await preload(buildConfig())
  progress.value = null
}

export async function processRemoveBg(input: string | Blob, modeOverride?: ProcessMode): Promise<Blob> {
  if (!(await checkSupport())) throw new Error('当前浏览器不支持（需要 WebAssembly）')
  saveOptions(options)
  const config = buildConfig()
  const mode = modeOverride ?? options.mode
  let result: Blob
  switch (mode) {
    case 'remove-fg':
      result = await removeForeground(input, config)
      break
    case 'mask':
      result = await segmentForeground(input, config)
      break
    default:
      result = await removeBackground(input, config)
  }
  progress.value = null
  return result
}

export function useRemoveBg() {
  return { options, supported, webgpuSupported, progress, checkSupport, preloadModel, processRemoveBg }
}
