import type { CustomHtmlProps } from './customHtmlContract'
import { inspectCustomCss, inspectCustomHtml } from './customHtmlRuntime'
import { validateCustomHtml } from './definitions'
import { asObject } from './validationUtils'

export function validateCustomHtmlConfig(value: unknown) {
  const issues: { fieldPath: string; message: string }[] = []
  const config = asObject(value)
  if (!config) return [{ fieldPath: 'custom', message: '缺少自定义代码配置' }]
  validateCustomHtml(
    config,
    'custom',
    {
      push(message, fieldPath) {
        issues.push({ fieldPath: fieldPath ? `custom.${fieldPath}` : 'custom', message })
      },
    },
    { hidden: false },
  )
  if (issues.length) return issues
  const { html, css, assets } = value as CustomHtmlProps
  for (const issue of [...inspectCustomHtml(html, assets), ...inspectCustomCss(css, assets).issues]) {
    issues.push({ fieldPath: `custom.${issue.field}:${issue.line}:${issue.column}`, message: issue.message })
  }
  return issues
}
