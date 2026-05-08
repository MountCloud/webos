/**
 * createWebosTheme
 * 把 webos 的设计 token 编译成 MUI Theme
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { createTheme, type Theme } from '@mui/material/styles'
import { getTokens, sharedTokens, type ThemeMode } from './tokens'

export interface CreateWebosThemeOptions {
  mode?: ThemeMode
  // 允许业务方在 webos 主题基础上做局部覆盖
  overrides?: Parameters<typeof createTheme>[0]
}

export function createWebosTheme(options: CreateWebosThemeOptions = {}): Theme {
  const mode = options.mode ?? 'light'
  const t = getTokens(mode)

  const base = createTheme({
    palette: {
      mode,
      primary: { main: t.primary, dark: t.primaryHover, contrastText: t.textInverse },
      error: { main: t.danger },
      warning: { main: t.warning },
      success: { main: t.success },
      info: { main: t.info },
      background: {
        default: t.bgBase,
        paper: t.bgWindow,
      },
      text: {
        primary: t.text,
        secondary: t.textMuted,
      },
      divider: t.border,
      action: {
        hover: t.hover,
        selected: t.active,
      },
    },
    typography: {
      fontFamily: sharedTokens.fontFamily,
      fontSize: 13,
      h1: { fontWeight: 600 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: {
      borderRadius: sharedTokens.radiusMd,
    },
    spacing: sharedTokens.spacingUnit,
    transitions: {
      duration: {
        shortest: 100,
        shorter: 150,
        short: 200,
        standard: 250,
        complex: 350,
        enteringScreen: 200,
        leavingScreen: 150,
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: sharedTokens.radiusMd,
            paddingInline: 16,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: sharedTokens.radiusMd,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: `0 1px 3px ${t.shadow}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 12,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: sharedTokens.radiusLg,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: t.bgBase,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            color: t.text,
          },
        },
      },
    },
  })

  if (options.overrides) {
    return createTheme(base, options.overrides)
  }
  return base
}
