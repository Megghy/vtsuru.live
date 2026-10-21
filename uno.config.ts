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
      border: 'hsl(var(--border) / <alpha-value>)',
      input: 'hsl(var(--input) / <alpha-value>)',
      ring: 'hsl(var(--ring) / <alpha-value>)',
      background: 'hsl(var(--background) / <alpha-value>)',
      foreground: 'hsl(var(--foreground) / <alpha-value>)',
      primary: 'hsl(var(--primary) / <alpha-value>)',
      'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
      secondary: 'hsl(var(--secondary) / <alpha-value>)',
      'secondary-foreground': 'hsl(var(--secondary-foreground) / <alpha-value>)',
      destructive: 'hsl(var(--destructive) / <alpha-value>)',
      'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
      muted: 'hsl(var(--muted) / <alpha-value>)',
      'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
      accent: 'hsl(var(--accent) / <alpha-value>)',
      'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
      popover: 'hsl(var(--popover) / <alpha-value>)',
      'popover-foreground': 'hsl(var(--popover-foreground) / <alpha-value>)',
      card: 'hsl(var(--card) / <alpha-value>)',
      'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
      brand: 'hsl(var(--brand) / <alpha-value>)',
      'brand-foreground': 'hsl(var(--brand-foreground) / <alpha-value>)',
      'brand-soft': 'var(--vtsuru-brand-soft)',
      'brand-tint': 'var(--vtsuru-brand-tint)',
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
  },
  shortcuts: [
    // 常用微交互与紧凑型管理台快捷类
    ['btn-interactive', 'transition-all duration-150 active:scale-[0.98] select-none'],
    ['panel-surface', 'bg-card border border-border rounded-lg shadow-sm'],
  ],
})
