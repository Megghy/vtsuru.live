type HyperDXClient = {
  recordException: (error: Error, attributes?: Record<string, string>) => void
}

export type UserPageErrorPhase = 'user' | 'settings' | 'bili-profile' | 'render' | 'save-draft' | 'clear-draft' | 'publish' | 'rollback' | 'upload'

function reportError(cause: unknown, phase: UserPageErrorPhase, feature: 'public-user-page' | 'user-page-builder') {
  const sourceName = cause instanceof Error ? cause.name : typeof cause
  console.error(`[user-page:${phase}] ${sourceName}`)
  const observedError = new Error(`User page ${phase} failed`)
  observedError.name = 'UserPageError'
  const client = (window as typeof window & { __HyperDX__?: HyperDXClient }).__HyperDX__
  client?.recordException(observedError, {
    feature,
    phase,
    sourceType: sourceName,
  })
}

export function reportPublicPageError(cause: unknown, phase: Extract<UserPageErrorPhase, 'user' | 'settings' | 'bili-profile' | 'render'>) {
  reportError(cause, phase, 'public-user-page')
}

export function reportUserPageError(cause: unknown, phase: Extract<UserPageErrorPhase, 'save-draft' | 'clear-draft' | 'publish' | 'rollback' | 'upload'>) {
  reportError(cause, phase, 'user-page-builder')
}
