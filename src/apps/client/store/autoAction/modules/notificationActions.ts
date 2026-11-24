import { sendCustomClientNotification } from '@/apps/client/data/notification'
import { isTauri } from '@/shared/config'
import { useOBSNotification } from '@/store/useOBSNotification'
import { useSpeechService } from '@/store/useSpeechService'

import { processTemplate } from '../actionUtils'
import { evaluateTemplateExpressions } from '../expressionEvaluator'
import type { AutoActionItem, ExecutionContext, RuntimeState } from '../types'

function renderTemplateOrEmpty(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  useSequentialTemplate?: boolean,
): string {
  return (
    processTemplate(action, context, {
      useSequentialTemplate,
      runtimeState,
      defaultValue: '',
    }) ?? ''
  )
}

export async function executeSendNotificationAction(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  useSequentialTemplate?: boolean,
): Promise<string> {
  const cfg = action.actionConfig
  const rawTitle = cfg.notificationTitle?.trim()
  const title = rawTitle ? evaluateTemplateExpressions(rawTitle, context).trim() : action.name || '自动提醒'
  const body = renderTemplateOrEmpty(action, context, runtimeState, useSequentialTemplate).trim()

  if (!title && !body) {
    throw new Error('通知标题与正文不能同时为空')
  }

  const showDesktop = cfg.notificationShowDesktop ?? true
  const showToast = cfg.notificationShowToast ?? true
  const playSound = cfg.notificationPlaySound ?? true

  await sendCustomClientNotification({
    title,
    body,
    showDesktop,
    showToast,
    toastLevel: cfg.notificationToastLevel ?? 'info',
    playSound,
    soundPreset: cfg.notificationSoundPreset ?? 'chime',
    bypassGlobalSwitch: cfg.notificationBypassGlobalSwitch,
    extra: { type: 'auto-action', actionId: action.id },
  })

  return `[${title}] ${body}`.trim()
}

export async function executeObsNotifyAction(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  useSequentialTemplate?: boolean,
): Promise<string> {
  const cfg = action.actionConfig
  const message = renderTemplateOrEmpty(action, context, runtimeState, useSequentialTemplate).trim()
  if (!message) {
    throw new Error('OBS 浮窗通知内容不能为空')
  }

  const rawTitle = cfg.obsNotifyTitle?.trim()
  const title = rawTitle ? evaluateTemplateExpressions(rawTitle, context).trim() : action.name || '直播提醒'
  const userName = typeof context.variables?.user?.name === 'string' ? context.variables.user.name : null

  await useOBSNotification().publish({
    Type: cfg.obsNotifyType ?? 'success',
    Title: title,
    Message: message,
    Source: cfg.obsNotifySource?.trim() || 'auto-action',
    UserName: userName,
  })

  return `[OBS ${cfg.obsNotifyType ?? 'success'}] ${title}: ${message}`
}

export async function executeSpeakTtsAction(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  useSequentialTemplate?: boolean,
): Promise<string> {
  const text = renderTemplateOrEmpty(action, context, runtimeState, useSequentialTemplate).trim()
  if (!text) {
    throw new Error('语音播报内容不能为空')
  }

  await useSpeechService().speakText(text)
  return `TTS: ${text}`
}

export async function executeSendWebhookAction(
  action: AutoActionItem,
  context: ExecutionContext,
  runtimeState: RuntimeState,
  useSequentialTemplate?: boolean,
): Promise<string> {
  const cfg = action.actionConfig
  const rawUrl = cfg.webhookUrl?.trim()
  if (!rawUrl) {
    throw new Error('Webhook URL 不能为空')
  }

  const targetUrl = evaluateTemplateExpressions(rawUrl, context).trim()
  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    throw new Error(`无效的 Webhook URL: ${targetUrl}`)
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Webhook 仅支持 http/https 协议')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cfg.webhookHeadersJson?.trim()) {
    let customHeaders: unknown
    try {
      customHeaders = JSON.parse(cfg.webhookHeadersJson)
    } catch {
      throw new Error('Webhook 自定义请求头不是合法的 JSON')
    }
    if (!customHeaders || typeof customHeaders !== 'object' || Array.isArray(customHeaders)) {
      throw new Error('Webhook 自定义请求头必须为键值对象')
    }
    for (const [k, v] of Object.entries(customHeaders)) {
      if (v !== undefined && v !== null) {
        headers[k] = String(v)
      }
    }
  }

  const body = cfg.webhookBodyTemplate?.trim()
    ? evaluateTemplateExpressions(cfg.webhookBodyTemplate, context)
    : JSON.stringify({
        source: 'vtsuru-auto-action',
        actionId: action.id,
        actionName: action.name,
        triggerType: action.triggerType,
        roomId: context.roomId ?? null,
        timestamp: context.timestamp,
        message: renderTemplateOrEmpty(action, context, runtimeState, useSequentialTemplate),
        user: context.variables?.user ?? null,
        live: context.variables?.live ?? null,
        system: context.variables?.system ?? null,
      })

  const method = cfg.webhookMethod ?? 'POST'
  const fetchFn = isTauri() ? (await import('@tauri-apps/plugin-http')).fetch : globalThis.fetch
  const resp = await fetchFn(parsedUrl.toString(), {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!resp.ok) {
    const errSnippet = await resp.text().catch(() => '')
    throw new Error(`Webhook HTTP ${resp.status}${errSnippet ? `: ${errSnippet.slice(0, 120)}` : ''}`)
  }

  return `${method} ${parsedUrl.origin}${parsedUrl.pathname} -> ${resp.status}`
}
