import { defineConfig, presetWind3 } from 'unocss'

// tailwindcss-animate keyframes + duration variable bridge
const animatePreflightCSS = `
@keyframes enter {
  from {
    opacity: var(--tw-enter-opacity, 1);
    transform: translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0)
      scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), var(--tw-enter-scale, 1))
      rotate(var(--tw-enter-rotate, 0));
  }
}
@keyframes exit {
  to {
    opacity: var(--tw-exit-opacity, 1);
    transform: translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0)
      scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), var(--tw-exit-scale, 1))
      rotate(var(--tw-exit-rotate, 0));
  }
}
@keyframes accordion-down {
  from { height: 0; }
  to   { height: var(--reka-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--reka-accordion-content-height); }
  to   { height: 0; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
/* duration-* also sets --tw-animation-duration so animate-in/out respect it */
.duration-75  { --tw-animation-duration: 75ms;   }
.duration-100 { --tw-animation-duration: 100ms;  }
.duration-150 { --tw-animation-duration: 150ms;  }
.duration-200 { --tw-animation-duration: 200ms;  }
.duration-300 { --tw-animation-duration: 300ms;  }
.duration-500 { --tw-animation-duration: 500ms;  }
.duration-700 { --tw-animation-duration: 700ms;  }
.duration-1000{ --tw-animation-duration: 1000ms; }
`

export default defineConfig({
  presets: [
    presetWind3(),
  ],
  preflights: [
    { getCSS: () => animatePreflightCSS },
  ],
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        'src/**/*.{ts,js}',
      ],
    },
  },
  safelist: [
    'text-primary',
    'text-primary-foreground',
    'text-secondary',
    'text-secondary-foreground',
    'text-muted',
    'text-muted-foreground',
    'text-destructive',
    'text-destructive-foreground',
    'text-accent',
    'text-accent-foreground',
    'text-brand',
    'text-brand-foreground',
    'bg-primary',
    'bg-secondary',
    'bg-muted',
    'bg-destructive',
    'bg-accent',
    'bg-brand',
  ],
  rules: [
    // ── animate-in / animate-out core ──────────────────────────────────────
    ['animate-in', {
      'animation-name': 'enter',
      'animation-duration': 'var(--tw-animation-duration, 150ms)',
      'animation-fill-mode': 'both',
      '--tw-enter-opacity': 'initial',
      '--tw-enter-scale': 'initial',
      '--tw-enter-rotate': 'initial',
      '--tw-enter-translate-x': 'initial',
      '--tw-enter-translate-y': 'initial',
    }],
    ['animate-out', {
      'animation-name': 'exit',
      'animation-duration': 'var(--tw-animation-duration, 150ms)',
      'animation-fill-mode': 'both',
      '--tw-exit-opacity': 'initial',
      '--tw-exit-scale': 'initial',
      '--tw-exit-rotate': 'initial',
      '--tw-exit-translate-x': 'initial',
      '--tw-exit-translate-y': 'initial',
    }],

    // ── Accordion ──────────────────────────────────────────────────────────
    ['animate-accordion-down', { animation: 'accordion-down 0.2s ease-out' }],
    ['animate-accordion-up',   { animation: 'accordion-up 0.2s ease-out'   }],

    // ── Spin (standard rotation animation) ───────────────────────────────────
    ['animate-spin', { animation: 'spin 1s linear infinite' }],

    // ── Fade modifiers ─────────────────────────────────────────────────────
    [/^fade-in-(\d+)$/, ([, n]) => ({ '--tw-enter-opacity': `${Number(n) / 100}` })],
    [/^fade-out-(\d+)$/, ([, n]) => ({ '--tw-exit-opacity':  `${Number(n) / 100}` })],

    // ── Zoom modifiers ─────────────────────────────────────────────────────
    [/^zoom-in-(\d+)$/,  ([, n]) => ({ '--tw-enter-scale': `${Number(n) / 100}` })],
    [/^zoom-out-(\d+)$/, ([, n]) => ({ '--tw-exit-scale':  `${Number(n) / 100}` })],

    // ── Slide in from (full 100%) ──────────────────────────────────────────
    ['slide-in-from-top',    { '--tw-enter-translate-y': '-100%' }],
    ['slide-in-from-bottom', { '--tw-enter-translate-y':  '100%' }],
    ['slide-in-from-left',   { '--tw-enter-translate-x': '-100%' }],
    ['slide-in-from-right',  { '--tw-enter-translate-x':  '100%' }],

    // ── Slide in from (spacing scale n × 0.25rem) ─────────────────────────
    [/^slide-in-from-top-(\d+)$/,    ([, n]) => ({ '--tw-enter-translate-y': `-${Number(n) * 0.25}rem` })],
    [/^slide-in-from-bottom-(\d+)$/, ([, n]) => ({ '--tw-enter-translate-y':  `${Number(n) * 0.25}rem` })],
    [/^slide-in-from-left-(\d+)$/,   ([, n]) => ({ '--tw-enter-translate-x': `-${Number(n) * 0.25}rem` })],
    [/^slide-in-from-right-(\d+)$/,  ([, n]) => ({ '--tw-enter-translate-x':  `${Number(n) * 0.25}rem` })],

    // ── Slide in from (fraction n/d → percentage) ─────────────────────────
    [/^slide-in-from-top-(\d+)\/(\d+)$/,    ([, n, d]) => ({ '--tw-enter-translate-y': `-${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-in-from-bottom-(\d+)\/(\d+)$/, ([, n, d]) => ({ '--tw-enter-translate-y':  `${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-in-from-left-(\d+)\/(\d+)$/,   ([, n, d]) => ({ '--tw-enter-translate-x': `-${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-in-from-right-(\d+)\/(\d+)$/,  ([, n, d]) => ({ '--tw-enter-translate-x':  `${(+n / +d * 100).toFixed(4)}%` })],

    // ── Slide in from (arbitrary value [v]) ───────────────────────────────
    [/^slide-in-from-top-\[(.+)\]$/,    ([, v]) => ({ '--tw-enter-translate-y': `-${v}` })],
    [/^slide-in-from-bottom-\[(.+)\]$/, ([, v]) => ({ '--tw-enter-translate-y':  v })],
    [/^slide-in-from-left-\[(.+)\]$/,   ([, v]) => ({ '--tw-enter-translate-x': `-${v}` })],
    [/^slide-in-from-right-\[(.+)\]$/,  ([, v]) => ({ '--tw-enter-translate-x':  v })],

    // ── Slide out to (full 100%) ───────────────────────────────────────────
    ['slide-out-to-top',    { '--tw-exit-translate-y': '-100%' }],
    ['slide-out-to-bottom', { '--tw-exit-translate-y':  '100%' }],
    ['slide-out-to-left',   { '--tw-exit-translate-x': '-100%' }],
    ['slide-out-to-right',  { '--tw-exit-translate-x':  '100%' }],

    // ── Slide out to (spacing scale) ──────────────────────────────────────
    [/^slide-out-to-top-(\d+)$/,    ([, n]) => ({ '--tw-exit-translate-y': `-${Number(n) * 0.25}rem` })],
    [/^slide-out-to-bottom-(\d+)$/, ([, n]) => ({ '--tw-exit-translate-y':  `${Number(n) * 0.25}rem` })],
    [/^slide-out-to-left-(\d+)$/,   ([, n]) => ({ '--tw-exit-translate-x': `-${Number(n) * 0.25}rem` })],
    [/^slide-out-to-right-(\d+)$/,  ([, n]) => ({ '--tw-exit-translate-x':  `${Number(n) * 0.25}rem` })],

    // ── Slide out to (fraction) ────────────────────────────────────────────
    [/^slide-out-to-top-(\d+)\/(\d+)$/,    ([, n, d]) => ({ '--tw-exit-translate-y': `-${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-out-to-bottom-(\d+)\/(\d+)$/, ([, n, d]) => ({ '--tw-exit-translate-y':  `${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-out-to-left-(\d+)\/(\d+)$/,   ([, n, d]) => ({ '--tw-exit-translate-x': `-${(+n / +d * 100).toFixed(4)}%` })],
    [/^slide-out-to-right-(\d+)\/(\d+)$/,  ([, n, d]) => ({ '--tw-exit-translate-x':  `${(+n / +d * 100).toFixed(4)}%` })],

    // ── Slide out to (arbitrary value) ────────────────────────────────────
    [/^slide-out-to-top-\[(.+)\]$/,    ([, v]) => ({ '--tw-exit-translate-y': `-${v}` })],
    [/^slide-out-to-bottom-\[(.+)\]$/, ([, v]) => ({ '--tw-exit-translate-y':  v })],
    [/^slide-out-to-left-\[(.+)\]$/,   ([, v]) => ({ '--tw-exit-translate-x': `-${v}` })],
    [/^slide-out-to-right-\[(.+)\]$/,  ([, v]) => ({ '--tw-exit-translate-x':  v })],

    // duration-* also needs to set --tw-animation-duration for data-variant usage
    // (e.g. data-[state=closed]:duration-300 on Sheet)
    [/^duration-(\d+)$/, ([, n]) => ({ '--tw-animation-duration': `${n}ms` })],
  ],
  theme: {
    colors: {
      border: 'color-mix(in srgb, var(--border) calc(<alpha-value> * 100%), transparent)',
      input: 'color-mix(in srgb, var(--input) calc(<alpha-value> * 100%), transparent)',
      ring: 'color-mix(in srgb, var(--ring) calc(<alpha-value> * 100%), transparent)',
      background: 'color-mix(in srgb, var(--background) calc(<alpha-value> * 100%), transparent)',
      foreground: 'color-mix(in srgb, var(--foreground) calc(<alpha-value> * 100%), transparent)',
      primary: 'color-mix(in srgb, var(--primary) calc(<alpha-value> * 100%), transparent)',
      'primary-foreground': 'color-mix(in srgb, var(--primary-foreground) calc(<alpha-value> * 100%), transparent)',
      secondary: 'color-mix(in srgb, var(--secondary) calc(<alpha-value> * 100%), transparent)',
      'secondary-foreground': 'color-mix(in srgb, var(--secondary-foreground) calc(<alpha-value> * 100%), transparent)',
      destructive: 'color-mix(in srgb, var(--destructive) calc(<alpha-value> * 100%), transparent)',
      'destructive-foreground': 'color-mix(in srgb, var(--destructive-foreground) calc(<alpha-value> * 100%), transparent)',
      muted: 'color-mix(in srgb, var(--muted) calc(<alpha-value> * 100%), transparent)',
      'muted-foreground': 'color-mix(in srgb, var(--muted-foreground) calc(<alpha-value> * 100%), transparent)',
      accent: 'color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)',
      'accent-foreground': 'color-mix(in srgb, var(--accent-foreground) calc(<alpha-value> * 100%), transparent)',
      popover: 'color-mix(in srgb, var(--popover) calc(<alpha-value> * 100%), transparent)',
      'popover-foreground': 'color-mix(in srgb, var(--popover-foreground) calc(<alpha-value> * 100%), transparent)',
      card: 'color-mix(in srgb, var(--card) calc(<alpha-value> * 100%), transparent)',
      'card-foreground': 'color-mix(in srgb, var(--card-foreground) calc(<alpha-value> * 100%), transparent)',
      brand: 'color-mix(in srgb, var(--brand) calc(<alpha-value> * 100%), transparent)',
      'brand-foreground': 'color-mix(in srgb, var(--brand-foreground) calc(<alpha-value> * 100%), transparent)',
      'brand-soft': 'color-mix(in srgb, var(--brand-soft) calc(<alpha-value> * 100%), transparent)',
      'brand-tint': 'color-mix(in srgb, var(--brand-tint) calc(<alpha-value> * 100%), transparent)',
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'var(--radius-control)',
      sm: 'var(--radius-small)',
    },
  },
  shortcuts: [
    // 常用微交互与紧凑型管理台快捷类
    ['btn-interactive', 'transition-all duration-150 active:scale-[0.98] select-none'],
    ['panel-surface', 'bg-card border border-border rounded-lg shadow-sm'],
  ],
})
