import { useEffect, useState, useMemo } from 'react'
import { Webos } from '@webos/host-sdk'
import {
  AppBar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CloseIcon from '@mui/icons-material/Close'

interface Row {
  id: number
  name: string
  level: 'info' | 'warning' | 'critical'
  time: string
}

const initialRows: Row[] = [
  { id: 1, name: 'Bob 登录', level: 'info', time: '10:24' },
  { id: 2, name: '权限申请：导出数据', level: 'warning', time: '11:02' },
  { id: 3, name: 'U 盘插入', level: 'critical', time: '11:18' },
  { id: 4, name: '配置变更：审计开关', level: 'info', time: '12:30' },
]

export function App(): JSX.Element {
  const theme = useTheme()
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [snack, setSnack] = useState<string | null>(null)
  const [name, setName] = useState('Alice')
  const [autoSave, setAutoSave] = useState(true)
  const [appCount, setAppCount] = useState<number | null>(null)

  const [view, setView] = useState<string>(() => {
    const url = new URL(window.location.href)
    return url.searchParams.get('view') ?? 'events'
  })

  // 监听 webos 全局事件
  useEffect(() => {
    const offPing = Webos.events.on('demo.ping', (payload) => {
      setSnack(`收到 ping: ${JSON.stringify(payload)}`)
    })
    // 子功能深链：从全局搜索点"新建事件"等，应用已运行时桌面壳推 app.navigate
    const offNav = Webos.events.on('app.navigate', (payload) => {
      const p = payload as { uri?: string; feature?: string }
      const m = p.uri?.match(/[?&]view=([^&]+)/)
      const v = m?.[1] ?? p.feature ?? 'events'
      setView(v)
      setSnack(`深链跳转：view=${v}`)
    })
    return () => {
      offPing()
      offNav()
    }
  }, [])

  const themeName = useMemo(() => (theme.palette.mode === 'dark' ? '深色' : '浅色'), [theme])

  const handleNotify = (level: 'info' | 'success' | 'warning' | 'critical') => () => {
    Webos.notify({
      title: `${level.toUpperCase()} 通知`,
      message: `这是一条 ${level} 级别的通知，从 React + MUI 应用发出`,
      level,
    })
  }

  const handleConfirmDelete = async () => {
    const ok = await Webos.dialog.confirm({
      title: '确认删除',
      message: `即将删除 ${rows.length} 条记录，此操作不可撤销。`,
      icon: 'warning',
      confirmText: '永久删除',
      cancelText: '保留',
      danger: true,
    })
    if (ok) {
      setRows([])
      Webos.notify({ title: '已清空', level: 'success' })
    }
  }

  const handlePrompt = async () => {
    const v = await Webos.dialog.prompt({
      message: '请输入新记录名称',
      defaultValue: '新事件',
      placeholder: '事件名',
    })
    if (v) {
      setRows((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: v,
          level: 'info',
          time: new Date().toLocaleTimeString(),
        },
      ])
    }
  }

  const handleCustomDialog = async () => {
    const action = await Webos.dialog.show<'save' | 'discard' | 'cancel'>({
      title: '保存修改？',
      message: '当前页面有未保存的修改。',
      icon: 'question',
      buttons: [
        { label: '不保存', value: 'discard', type: 'danger' },
        { label: '取消', value: 'cancel', type: 'secondary', cancel: true },
        { label: '保存', value: 'save', type: 'primary', autoFocus: true },
      ],
    })
    setSnack(`你点了：${action}`)
  }

  const handleSetTitle = async () => {
    const t = `React+MUI · ${new Date().toLocaleTimeString()}`
    await Webos.window.setTitle(t)
    setSnack(`窗口标题改为：${t}`)
  }

  const handleListApps = async () => {
    const list = await Webos.apps.list()
    setAppCount(list.length)
  }

  const handleToggleTheme = async () => {
    const cur = await Webos.theme.current()
    await Webos.theme.set(cur === 'dark' ? 'light' : 'dark')
  }

  const handleBroadcast = () => {
    void Webos.events.emit('demo.ping', { from: 'react-mui', t: Date.now() })
    setSnack('已广播 demo.ping')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            🎨 React + MUI 示例
          </Typography>
          <Chip
            size="small"
            label={`view=${view}`}
            sx={{ mr: 1 }}
            color="default"
            variant="outlined"
          />
          <Chip
            size="small"
            label={`MUI 主题：${themeName}`}
            color={theme.palette.mode === 'dark' ? 'default' : 'primary'}
            variant="outlined"
          />
          <Tooltip title="切换 webos 主题（联动 MUI）">
            <Switch
              checked={theme.palette.mode === 'dark'}
              onChange={handleToggleTheme}
              sx={{ ml: 1 }}
            />
          </Tooltip>
          <Tooltip title="关闭应用">
            <IconButton color="inherit" onClick={() => Webos.window.close()}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                通知（Webos.notify）
              </Typography>
              <ButtonGroup variant="outlined" size="small">
                <Button onClick={handleNotify('info')}>Info</Button>
                <Button onClick={handleNotify('success')} color="success">
                  Success
                </Button>
                <Button onClick={handleNotify('warning')} color="warning">
                  Warning
                </Button>
                <Button onClick={handleNotify('critical')} color="error">
                  Critical
                </Button>
              </ButtonGroup>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                对话框（Webos.dialog.*）
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  onClick={() =>
                    Webos.dialog.alert({
                      message: '这是从 React 调用的 alert，带图标',
                      title: '提示',
                      icon: 'info',
                    })
                  }
                >
                  Alert
                </Button>
                <Button variant="outlined" color="warning" onClick={handleConfirmDelete}>
                  Confirm（带危险样式）
                </Button>
                <Button variant="outlined" onClick={handlePrompt}>
                  Prompt
                </Button>
                <Button variant="contained" onClick={handleCustomDialog}>
                  自定义按钮 dialog.show
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                窗口 / 系统
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button onClick={handleSetTitle} variant="outlined">
                  改窗口标题
                </Button>
                <Button onClick={() => Webos.window.minimize()} variant="outlined">
                  最小化
                </Button>
                <Button onClick={handleListApps} variant="outlined">
                  列出已注册应用
                </Button>
                <Button onClick={handleBroadcast} variant="outlined">
                  广播全局事件
                </Button>
                {appCount !== null && (
                  <Chip label={`共 ${appCount} 个应用`} color="primary" size="small" />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                表单
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="姓名"
                  size="small"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">自动保存</Typography>
                  <Switch
                    size="small"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                  />
                </Box>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={() =>
                  Webos.notify({
                    title: `已保存 ${name}`,
                    message: autoSave ? '将每分钟自动保存' : '关闭了自动保存',
                    level: 'success',
                  })
                }>
                  保存
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2" color="primary">
                  事件列表
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<NotificationsIcon />}
                    onClick={handlePrompt}
                  >
                    新增
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleConfirmDelete}
                    disabled={rows.length === 0}
                  >
                    清空
                  </Button>
                </Stack>
              </Stack>
              <Divider />
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>事件</TableCell>
                      <TableCell>级别</TableCell>
                      <TableCell align="right">时间</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, opacity: 0.6 }}>
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell>{r.id}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={r.level}
                              color={
                                r.level === 'critical'
                                  ? 'error'
                                  : r.level === 'warning'
                                    ? 'warning'
                                    : 'info'
                              }
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">{r.time}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        message={snack ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
