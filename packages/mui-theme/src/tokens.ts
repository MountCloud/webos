/**
 * webos 设计 token → MUI 主题字段 的映射
 * 与 apps/webos-shell/src/styles/tokens.scss 保持一致
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export type ThemeMode = 'light' | 'dark'

// 颜色：与 :root 的 --webos-color-* 同源
const lightTokens = {
  primary: '#2c5282',
  primaryHover: '#2a4d75',
  bgBase: '#f5f7fa',
  bgWindow: '#ffffff',
  bgGlass: 'rgba(255, 255, 255, 0.85)',
  text: '#1a202c',
  textMuted: '#718096',
  textInverse: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  shadow: 'rgba(0, 0, 0, 0.12)',
  danger: '#c53030',
  warning: '#d97706',
  success: '#2f855a',
  info: '#3182ce',
  hover: 'rgba(0, 0, 0, 0.05)',
  active: 'rgba(0, 0, 0, 0.10)',
}

const darkTokens = {
  primary: '#2c5282',
  primaryHover: '#3a6298',
  bgBase: '#1a202c',
  bgWindow: '#2d3748',
  bgGlass: 'rgba(45, 55, 72, 0.85)',
  text: '#f7fafc',
  textMuted: '#a0aec0',
  textInverse: '#1a202c',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.2)',
  shadow: 'rgba(0, 0, 0, 0.4)',
  danger: '#c53030',
  warning: '#d97706',
  success: '#2f855a',
  info: '#3182ce',
  hover: 'rgba(255, 255, 255, 0.08)',
  active: 'rgba(255, 255, 255, 0.16)',
}

export function getTokens(mode: ThemeMode) {
  return mode === 'dark' ? darkTokens : lightTokens
}

// 共用：字号、圆角、间距、动效 —— 与 webos shell 一致
export const sharedTokens = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  fontMono: '"SF Mono", Menlo, Consolas, "Courier New", monospace',
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 8,
  radiusXl: 12,
  // MUI 用 spacing(1) = 8px 的逻辑，刚好与 webos 一致
  spacingUnit: 8,
  transitionFast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionNormal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  transitionSlow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
}
