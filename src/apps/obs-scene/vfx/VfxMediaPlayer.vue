<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { VfxMediaConfig } from './types'
import { detectVfxMediaFormat } from './types'

const props = defineProps<{
  media: VfxMediaConfig
  mode: 'edit' | 'preview' | 'live'
}>()

const resolvedFormat = computed(() => detectVfxMediaFormat(props.media.url, props.media.format))
const needsVideoKeying = computed(
  () => resolvedFormat.value === 'video' && (props.media.alphaMode === 'luma-key' || props.media.alphaMode === 'chroma-key'),
)

const lottieContainerRef = ref<HTMLDivElement | null>(null)
const riveCanvasRef = ref<HTMLCanvasElement | null>(null)
const svgaCanvasRef = ref<HTMLCanvasElement | null>(null)
const pagCanvasRef = ref<HTMLCanvasElement | null>(null)
const keyedVideoRef = ref<HTMLVideoElement | null>(null)
const keyedCanvasRef = ref<HTMLCanvasElement | null>(null)
const nativeVideoRef = ref<HTMLVideoElement | null>(null)

const runtimeError = ref('')
const loading = ref(false)

let cleanupCurrent: (() => void) | null = null

function disposeActiveRuntime() {
  if (cleanupCurrent) {
    cleanupCurrent()
    cleanupCurrent = null
  }
  runtimeError.value = ''
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
    ]
  }
  return [0, 1, 0]
}

async function mountLottie(url: string) {
  const container = lottieContainerRef.value
  if (!container) return
  loading.value = true
  try {
    const lottieMod = await import('lottie-web')
    const lottie = lottieMod.default
    let animationData: Record<string, unknown> | undefined
    const cleanUrl = url.split(/[?#]/)[0].toLowerCase()

    if (cleanUrl.endsWith('.lottie')) {
      const [{ default: JSZip }, resp] = await Promise.all([import('jszip'), fetch(url)])
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const zip = await JSZip.loadAsync(await resp.arrayBuffer())
      let animPath = ''
      const manifestFile = zip.file('manifest.json')
      if (manifestFile) {
        const manifest = JSON.parse(await manifestFile.async('string')) as {
          animations?: Array<{ id?: string; path?: string }>
        }
        const first = manifest.animations?.[0]
        if (first?.path) animPath = first.path.replace(/^\/+/, '')
        else if (first?.id) animPath = `animations/${first.id}.json`
      }
      const animEntry =
        (animPath ? zip.file(animPath) : null) ||
        Object.values(zip.files).find((f) => !f.dir && f.name.endsWith('.json') && !f.name.endsWith('manifest.json'))
      if (!animEntry) throw new Error('.lottie 压缩包中未找到动画 JSON')
      animationData = JSON.parse(await animEntry.async('string')) as Record<string, unknown>
    } else {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      animationData = (await resp.json()) as Record<string, unknown>
    }

    container.innerHTML = ''
    const anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: props.media.loop,
      autoplay: true,
      animationData,
      rendererSettings: {
        preserveAspectRatio:
          props.media.objectFit === 'cover'
            ? 'xMidYMid slice'
            : props.media.objectFit === 'fill'
              ? 'none'
              : 'xMidYMid meet',
      },
    })
    anim.setSpeed(props.media.playbackRate)
    cleanupCurrent = () => {
      anim.destroy()
      if (container) container.innerHTML = ''
    }
  } catch (err) {
    runtimeError.value = `Lottie 加载失败: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    loading.value = false
  }
}

async function mountRive(url: string) {
  const canvas = riveCanvasRef.value
  if (!canvas) return
  loading.value = true
  try {
    const [{ Rive, RuntimeLoader, Layout, Fit, Alignment }, wasmUrlMod] = await Promise.all([
      import('@rive-app/canvas'),
      import('@rive-app/canvas/rive.wasm?url'),
    ])
    RuntimeLoader.setWasmUrl(wasmUrlMod.default)

    const fit =
      props.media.objectFit === 'cover'
        ? Fit.Cover
        : props.media.objectFit === 'fill'
          ? Fit.Fill
          : Fit.Contain

    const instance = new Rive({
      src: url,
      canvas,
      autoplay: true,
      artboard: props.media.riveArtboard || undefined,
      stateMachines: props.media.riveStateMachine || undefined,
      layout: new Layout({ fit, alignment: Alignment.Center }),
      onLoad: () => {
        instance.resizeDrawingSurfaceToCanvas()
        loading.value = false
      },
      onLoadError: () => {
        runtimeError.value = 'Rive (.riv) 文件加载或解析失败'
        loading.value = false
      },
    })

    const ro = new ResizeObserver(() => instance.resizeDrawingSurfaceToCanvas())
    ro.observe(canvas)
    cleanupCurrent = () => {
      ro.disconnect()
      instance.cleanup()
    }
  } catch (err) {
    runtimeError.value = `Rive 初始化失败: ${err instanceof Error ? err.message : String(err)}`
    loading.value = false
  }
}

async function mountSvga(url: string) {
  const canvas = svgaCanvasRef.value
  if (!canvas) return
  loading.value = true
  try {
    const { Parser, Player } = await import('svga')
    const parser = new Parser({ isDisableWebWorker: false })
    const player = new Player({
      container: canvas,
      loop: props.media.loop ? 0 : 1,
    })
    const videoEntity = await parser.load(url)
    await player.mount(videoEntity)
    player.start()
    cleanupCurrent = () => {
      player.stop()
      player.destroy()
      parser.destroy()
    }
  } catch (err) {
    runtimeError.value = `SVGA 加载失败: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    loading.value = false
  }
}

let pagModulePromise: Promise<Awaited<ReturnType<(typeof import('libpag'))['PAGInit']>>> | null = null

async function getPagRuntime() {
  if (!pagModulePromise) {
    pagModulePromise = Promise.all([
      import('libpag'),
      import('../../../../node_modules/libpag/lib/libpag.wasm?url'),
    ]).then(
      ([{ PAGInit }, wasmUrlMod]) =>
        PAGInit({
          locateFile: () => wasmUrlMod.default,
        }),
    )
  }
  return pagModulePromise
}

async function mountPag(url: string) {
  const canvas = pagCanvasRef.value
  if (!canvas) return
  loading.value = true
  try {
    const [PAG, resp] = await Promise.all([getPagRuntime(), fetch(url)])
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = await resp.arrayBuffer()
    const pagFile = await PAG.PAGFile.load(buffer)
    canvas.width = pagFile.width() || 512
    canvas.height = pagFile.height() || 512
    const pagView = await PAG.PAGView.init(pagFile, canvas)
    if (!pagView) throw new Error('PAGView 初始化失败')
    pagView.setRepeatCount(props.media.loop ? 0 : 1)
    await pagView.play()
    cleanupCurrent = () => {
      pagView.stop()
      pagView.destroy()
      pagFile.destroy()
    }
  } catch (err) {
    runtimeError.value = `PAG 加载失败: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    loading.value = false
  }
}

function mountKeyedVideo() {
  const video = keyedVideoRef.value
  const canvas = keyedCanvasRef.value
  if (!video || !canvas) return

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
  if (!gl) {
    runtimeError.value = 'WebGL 不可用，无法执行视频去底'
    return
  }

  const vsSrc = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `
  const fsSrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform int uMode;
    uniform vec3 uKeyColor;
    uniform float uThreshold;
    uniform float uSmoothness;
    uniform vec3 uTintColor;
    uniform float uTintStrength;

    void main() {
      vec4 tex = texture2D(uTex, vUv);
      vec3 col = tex.rgb;
      float alpha = tex.a;

      if (uMode == 1) {
        // 黑底去黑转 Alpha (Luma / Max-Channel Key，适配 AE/剪映黑底光效素材)
        float peak = max(col.r, max(col.g, col.b));
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float signal = mix(luma, peak, 0.65);
        alpha = smoothstep(uThreshold, uThreshold + max(0.01, uSmoothness), signal);
        col = alpha > 0.005 ? min(vec3(1.0), col / max(alpha, 0.25)) : vec3(0.0);
      } else if (uMode == 2) {
        // 绿幕 / 自定义色键抠底
        float dist = distance(col, uKeyColor);
        alpha = smoothstep(uThreshold, uThreshold + max(0.01, uSmoothness), dist);
      }

      if (uTintStrength > 0.001) {
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 tinted = uTintColor * max(lum * 1.4, 0.25);
        col = mix(col, tinted, uTintStrength);
      }

      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    }
  `

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const vs = compile(gl.VERTEX_SHADER, vsSrc)
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc)
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const posLoc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const uMode = gl.getUniformLocation(prog, 'uMode')
  const uKeyColor = gl.getUniformLocation(prog, 'uKeyColor')
  const uThreshold = gl.getUniformLocation(prog, 'uThreshold')
  const uSmoothness = gl.getUniformLocation(prog, 'uSmoothness')
  const uTintColor = gl.getUniformLocation(prog, 'uTintColor')
  const uTintStrength = gl.getUniformLocation(prog, 'uTintStrength')

  let rafId = 0
  let stopped = false

  const draw = () => {
    if (stopped) return
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(prog)
        gl.uniform1i(uMode, props.media.alphaMode === 'chroma-key' ? 2 : 1)
        const kc = hexToRgb01(props.media.keyColor)
        gl.uniform3f(uKeyColor, kc[0], kc[1], kc[2])
        gl.uniform1f(uThreshold, props.media.keyThreshold)
        gl.uniform1f(uSmoothness, props.media.keySmoothness)
        const tc = hexToRgb01(props.media.tintColor)
        gl.uniform3f(uTintColor, tc[0], tc[1], tc[2])
        gl.uniform1f(uTintStrength, props.media.tintStrength)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      } catch {
        runtimeError.value = '视频跨域未开启 CORS，无法读取像素去底（建议上传至本站素材库或使用支持 CORS 的直链）'
        stopped = true
        return
      }
    }
    rafId = requestAnimationFrame(draw)
  }

  video.playbackRate = props.media.playbackRate
  void video.play().catch(() => {})
  rafId = requestAnimationFrame(draw)

  cleanupCurrent = () => {
    stopped = true
    cancelAnimationFrame(rafId)
    gl.deleteTexture(tex)
    gl.deleteBuffer(buf)
    gl.deleteProgram(prog)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

watch(
  () => [
    props.media.url,
    resolvedFormat.value,
    props.media.alphaMode,
    props.media.loop,
    props.media.objectFit,
    props.media.riveStateMachine,
    props.media.riveArtboard,
  ],
  async () => {
    disposeActiveRuntime()
    const url = props.media.url.trim()
    if (!url) return
    await Promise.resolve()
    if (resolvedFormat.value === 'lottie') void mountLottie(url)
    else if (resolvedFormat.value === 'rive') void mountRive(url)
    else if (resolvedFormat.value === 'svga') void mountSvga(url)
    else if (resolvedFormat.value === 'pag') void mountPag(url)
    else if (needsVideoKeying.value) mountKeyedVideo()
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => props.media.playbackRate,
  (rate) => {
    if (nativeVideoRef.value) nativeVideoRef.value.playbackRate = rate
    if (keyedVideoRef.value) keyedVideoRef.value.playbackRate = rate
  },
)

onBeforeUnmount(() => {
  disposeActiveRuntime()
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <div
      v-if="!media.url.trim()"
      class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-sm px-4 text-center"
    >
      请在右侧上传或填写 VFX 素材地址（WebM / 黑底 MP4 / APNG / Lottie / Rive / SVGA / PAG）
    </div>

    <template v-else-if="resolvedFormat === 'image'">
      <img
        :src="media.url"
        alt="VFX"
        draggable="false"
        class="w-full h-full block"
        :style="{ objectFit: media.objectFit }"
      />
    </template>

    <template v-else-if="resolvedFormat === 'video' && !needsVideoKeying">
      <video
        ref="nativeVideoRef"
        :src="media.url"
        autoplay
        playsinline
        :loop="media.loop"
        :muted="media.muted"
        class="w-full h-full block"
        :style="{ objectFit: media.objectFit }"
        @loadedmetadata="nativeVideoRef && (nativeVideoRef.playbackRate = media.playbackRate)"
      />
    </template>

    <template v-else-if="needsVideoKeying">
      <video
        ref="keyedVideoRef"
        :src="media.url"
        crossorigin="anonymous"
        autoplay
        playsinline
        :loop="media.loop"
        :muted="media.muted"
        class="hidden"
      />
      <canvas
        ref="keyedCanvasRef"
        class="w-full h-full block"
        :style="{ objectFit: media.objectFit }"
      />
    </template>

    <div
      v-else-if="resolvedFormat === 'lottie'"
      ref="lottieContainerRef"
      class="w-full h-full"
    />

    <canvas
      v-else-if="resolvedFormat === 'rive'"
      ref="riveCanvasRef"
      class="w-full h-full block"
    />

    <canvas
      v-else-if="resolvedFormat === 'svga'"
      ref="svgaCanvasRef"
      class="w-full h-full block"
      :style="{ objectFit: media.objectFit }"
    />

    <canvas
      v-else-if="resolvedFormat === 'pag'"
      ref="pagCanvasRef"
      class="w-full h-full block"
      :style="{ objectFit: media.objectFit }"
    />

    <div
      v-if="loading && mode === 'edit'"
      class="pointer-events-none absolute inset-0 flex-center bg-black/25 text-white text-xs"
    >
      正在加载 VFX 素材...
    </div>

    <div
      v-if="runtimeError && mode === 'edit'"
      class="absolute inset-2 rounded bg-destructive/85 text-destructive-foreground p-2 text-xs overflow-auto"
    >
      {{ runtimeError }}
    </div>
  </div>
</template>
