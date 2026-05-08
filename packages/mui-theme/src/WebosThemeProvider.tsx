/**
 * WebosThemeProvider
 * 一行接入 webos 主题 + MUI 的 Provider 组件
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { type ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { useWebosTheme, type UseWebosThemeOptions } from './useWebosTheme'

export interface WebosThemeProviderProps extends UseWebosThemeOptions {
  children?: ReactNode
  // 是否注入 MUI 的 CssBaseline（默认 true）
  cssBaseline?: boolean
}

export function WebosThemeProvider(props: WebosThemeProviderProps): JSX.Element {
  const { children, cssBaseline = true, ...themeOpts } = props
  const theme = useWebosTheme(themeOpts)

  return (
    <ThemeProvider theme={theme}>
      {cssBaseline ? <CssBaseline /> : null}
      {children}
    </ThemeProvider>
  )
}
