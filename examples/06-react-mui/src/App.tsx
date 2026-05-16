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

  // openPage 演示：嵌入本应用的 "?view=edit&id=xxx" 表单页作为弹窗
  const [openPageResult, setOpenPageResult] = useState<string | null>(null)
  const handleOpenEditDialog = async (id: number) => {
    const r = await Webos.dialog.openPage<{ name: string; level: string }>({
      url: `./?view=edit&id=${id}`,
      title: `编辑工单 #${id}`,
      width: 520,
      height: 360,
      modal: 'parent',                                   // 阻塞本应用窗口
      buttons: [
        { id: 'save', label: '保存', type: 'primary', autoFocus: true },
        { id: 'cancel', label: '取消', cancel: true },
      ],
    })
    if (r.buttonId === 'save' && r.data) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, name: r.data!.name, level: r.data!.level as Row['level'] } : row,
        ),
      )
      setOpenPageResult(`#${id} 已保存：${r.data.name} (${r.data.level})`)
    } else {
      setOpenPageResult(`#${id} 取消了编辑`)
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

  // view=edit 是被 openPage 嵌入加载的"编辑表单页"
  // 整页就是一个表单，不画 AppBar / 主界面那一套
  if (view === 'edit') {
    return <EditDialogPage rows={initialRows} />
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
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, opacity: 0.6 }}>
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
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleOpenEditDialog(r.id)}
                            >
                              编辑
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {openPageResult && (
                <Typography
                  variant="caption"
                  sx={{ mt: 1, display: 'block', color: 'text.secondary' }}
                >
                  ↳ {openPageResult}
                </Typography>
              )}
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

// ============================================================
// EditDialogPage —— openPage 嵌入加载的"编辑工单"表单页
// 路径：./?view=edit&id=N （由 handleOpenEditDialog 触发）
//
// 关键点：
// 1. 不画 AppBar / 主界面，纯表单 —— 它整页就是 dialog 的 body
// 2. Webos.dialog.onAction() 接 "save" / "cancel" 按钮事件（footer 由宿主渲染）
// 3. 校验失败时返回 { close: false, error: '...' } 阻止关闭，宿主显示红字
// 4. 校验通过时返回 { close: true, data: {...} }，宿主 close dialog +
//    解决调用方 openPage 的 Promise
// ============================================================
function EditDialogPage({ rows }: { rows: Row[] }): JSX.Element {
  const idStr = new URL(window.location.href).searchParams.get('id') ?? ''
  const id = Number(idStr)
  const initial = rows.find((r) => r.id === id) ?? { id: 0, name: '', level: 'info' as const, time: '' }

  const [name, setName] = useState(initial.name)
  const [level, setLevel] = useState<Row['level']>(initial.level)

  useEffect(() => {
    // 注册按钮事件 —— host 端点 footer 上的 "保存" / "取消" 时回调
    const off = Webos.dialog.onAction(async (buttonId) => {
      if (buttonId === 'cancel') {
        // cancel 类按钮宿主已经在点的时候直接 settle，这里其实不会被触发；
        // 留作防御
        return { close: true }
      }
      if (buttonId === 'save') {
        const trimmed = name.trim()
        if (!trimmed) {
          return { close: false, error: '名称不能为空' }
        }
        if (trimmed.length > 32) {
          return { close: false, error: '名称不能超过 32 字符' }
        }
        // 模拟一个异步保存
        await new Promise((r) => setTimeout(r, 300))
        return { close: true, data: { name: trimmed, level } }
      }
      return undefined
    })
    return off
  }, [name, level])

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Typography variant="subtitle1" gutterBottom>
        正在编辑工单 #{id}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
        修改名称或级别后点 footer 的"保存"。空名称会被拦截不让关闭。
      </Typography>
      <Stack spacing={2} sx={{ flex: 1 }}>
        <TextField
          label="事件名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoFocus
          size="small"
          helperText="不能为空，不能超过 32 字符（输错点保存会被宿主拦截）"
        />
        <Box>
          <Typography variant="body2" gutterBottom>
            级别
          </Typography>
          <ButtonGroup size="small" variant="outlined">
            <Button
              variant={level === 'info' ? 'contained' : 'outlined'}
              onClick={() => setLevel('info')}
            >
              info
            </Button>
            <Button
              variant={level === 'warning' ? 'contained' : 'outlined'}
              color="warning"
              onClick={() => setLevel('warning')}
            >
              warning
            </Button>
            <Button
              variant={level === 'critical' ? 'contained' : 'outlined'}
              color="error"
              onClick={() => setLevel('critical')}
            >
              critical
            </Button>
          </ButtonGroup>
        </Box>
      </Stack>
    </Box>
  )
}
