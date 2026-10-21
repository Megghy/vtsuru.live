import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
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
      'brand-soft': 'var(--vtsuru-brand-soft)',
      'brand-tint': 'var(--vtsuru-brand-tint)',
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
