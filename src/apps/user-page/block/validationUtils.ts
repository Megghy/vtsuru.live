export interface ValidationErrors {
  push: (message: string, fieldPath?: string | null) => void
}
export type PropsObject = Record<string, unknown>

export function validationFieldPath(path: string, key: string) {
  const nestedPath = path.includes(': ') ? path.slice(path.lastIndexOf(': ') + 2) : ''
  return nestedPath ? `${nestedPath}.${key}` : key
}

export function asObject(value: unknown): PropsObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as PropsObject) : null
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function optionalString(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (props[key] !== undefined && typeof props[key] !== 'string')
    errors.push(`${path}: ${key} 必须是 string`, validationFieldPath(path, key))
}

export function requiredString(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (!isNonEmptyString(props[key])) errors.push(`${path}: ${key} 不能为空`, validationFieldPath(path, key))
}

export function optionalBoolean(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (props[key] !== undefined && typeof props[key] !== 'boolean')
    errors.push(`${path}: ${key} 必须是 boolean`, validationFieldPath(path, key))
}

export function optionalEnum(
  props: PropsObject,
  key: string,
  values: readonly unknown[],
  path: string,
  errors: ValidationErrors,
) {
  if (props[key] !== undefined && !values.includes(props[key]))
    errors.push(`${path}: ${key} 不支持`, validationFieldPath(path, key))
}

export function optionalNumber(
  props: PropsObject,
  key: string,
  min: number,
  max: number,
  path: string,
  errors: ValidationErrors,
  integer = false,
) {
  if (props[key] === undefined) return
  const value = Number(props[key])
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    errors.push(`${path}: ${key} 必须是 ${min}~${max} 的${integer ? '整数' : '数字'}`, validationFieldPath(path, key))
  }
}

export function optionalHttpsUrl(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (props[key] !== undefined && props[key] !== '' && !isHttpsUrl(props[key]))
    errors.push(`${path}: ${key} 必须是 https URL`, validationFieldPath(path, key))
}

export function optionalCssSize(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (props[key] === undefined) return
  if (typeof props[key] !== 'string' || (props[key].trim() && !/^\d+(?:\.\d+)?(?:px|%)$/.test(props[key].trim()))) {
    errors.push(`${path}: ${key} 仅支持 100% 或 480px 这类格式`, validationFieldPath(path, key))
  }
}

export function optionalFile(props: PropsObject, key: string, path: string, errors: ValidationErrors) {
  if (props[key] === undefined) return
  const file = asObject(props[key])
  if (!file || typeof file.id !== 'number' || !Number.isInteger(file.id) || file.id <= 0) {
    errors.push(`${path}: ${key}.id 必须是正整数`, validationFieldPath(path, key))
  }
}

export function validateItems(
  props: PropsObject,
  path: string,
  errors: ValidationErrors,
  validate: (item: PropsObject, itemPath: string) => void,
  required = false,
) {
  const items = props.items
  if (items === undefined && !required) return
  if (!Array.isArray(items)) {
    errors.push(`${path}: items 必须是 array`, validationFieldPath(path, 'items'))
    return
  }
  items.forEach((item, index) => {
    const object = asObject(item)
    const itemPath = `${path}: items[${index}]`
    if (!object) errors.push(`${itemPath} 必须是 object`, validationFieldPath(path, `items[${index}]`))
    else validate(object, itemPath)
  })
}

export function validateLinkTarget(props: PropsObject, path: string, errors: ValidationErrors) {
  const hasUrl = props.url !== undefined
  const hasPage = props.page !== undefined
  const hasBack = props.back === true
  if (props.back !== undefined && props.back !== true)
    errors.push(`${path}: back 必须为 true`, validationFieldPath(path, 'back'))
  const count = Number(hasUrl) + Number(hasPage) + Number(hasBack)
  if (count !== 1) errors.push(`${path}: 必须且只能提供 url/page/back 其中一个`)
  if (hasUrl && !isHttpsUrl(props.url)) errors.push(`${path}: url 必须是 https URL`, validationFieldPath(path, 'url'))
  if (
    hasPage &&
    (!isNonEmptyString(props.page) ||
      (props.page !== 'home' && !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(props.page)))
  ) {
    errors.push(`${path}: page 必须是 home 或合法 slug`, validationFieldPath(path, 'page'))
  }
}
