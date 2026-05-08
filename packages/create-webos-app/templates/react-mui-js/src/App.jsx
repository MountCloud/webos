import { useEffect, useState } from 'react'
import { Webos } from '@webos/host-sdk'
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material'

export function App() {
  const theme = useTheme()
  const [user, setUser] = useState(null)

  useEffect(() => {
    Webos.user.current().then(setUser)
    const off = Webos.user.on('change', ({ user }) => setUser(user))
    return off
  }, [])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            __DISPLAY_NAME__
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {user ? `已登录：${user.name}` : '未登录'} · 主题：{theme.palette.mode}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                欢迎 👋
              </Typography>
              <Typography variant="body2" color="text.secondary">
                这是一个由 <code>create-webos-app</code> 生成的 React + MUI 应用。
                MUI 主题自动跟随 webos 桌面主题切换。
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                试试 SDK
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="contained"
                  onClick={() =>
                    Webos.notify({ title: '保存成功', message: '来自 __DISPLAY_NAME__', level: 'success' })
                  }
                >
                  弹通知
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    const ok = await Webos.dialog.confirm('确认删除？')
                    Webos.notify({ title: ok ? '已删除' : '已取消' })
                  }}
                >
                  Confirm
                </Button>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    const t = `${import.meta.env.MODE} · ${new Date().toLocaleTimeString()}`
                    await Webos.window.setTitle(t)
                  }}
                >
                  改窗口标题
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
