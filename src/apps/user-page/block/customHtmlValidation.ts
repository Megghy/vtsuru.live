import type { CustomHtmlProps } from './customHtmlContract'
import { inspectCustomSource } from './customHtmlRuntime'
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
  const { source, assets } = value as CustomHtmlProps
  for (const item of inspectCustomSource(source, assets)) {
    issues.push({ fieldPath: `custom.${item.field}:${item.line}:${item.column}`, message: item.message })
  }
  return issues
}
