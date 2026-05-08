import { useEffect, useState, useCallback } from 'react'
import { Webos, type SystemInfo } from '@webos/host-sdk'

export function App(): JSX.Element {
  const [logs, setLogs] = useState<string[]>([])
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)

  const log = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }, [])

  useEffect(() => {
    log('组件已挂载')
    const offTheme = Webos.theme.on('change', (t) => log(`主题变更: ${t}`))
    const offMessage = Webos.message.on((msg, fromAppId) => {
      log(`收到 ${fromAppId} 的消息: ${JSON.stringify(msg)}`)
    })
    return () => {
      offTheme()
      offMessage()
    }
  }, [log])

  const wrap = (fn: () => Promise<unknown> | void) => () => {
    Promise.resolve(fn()).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      log(`错误: ${msg}`)
    })
  }

  return (
    <main>
      <h1>⚛️ React + TS 示例</h1>
      <p className="subtitle">React 18 + TypeScript + Vite，类型完全可推。</p>

      <section className="card">
        <h2>常用能力</h2>
        <button onClick={wrap(() => Webos.notify({ title: '来自 React', level: 'info' }))}>
          弹通知
        </button>
        <button
          onClick={wrap(async () => {
            await Webos.dialog.alert('React + TS 接入演示', '提示')
            log('alert 已关闭')
          })}
        >
          Alert
        </button>
        <button
          onClick={wrap(async () => {
            const r = await Webos.dialog.confirm('继续？')
            log(`confirm: ${r}`)
          })}
        >
          Confirm
        </button>
        <button
          onClick={wrap(async () => {
            const r = await Webos.dialog.prompt('输入', 'Hello')
            log(`prompt: ${r ?? '(取消)'}`)
          })}
        >
          Prompt
        </button>
        <button
          onClick={wrap(async () => {
            const t = `React · ${new Date().toLocaleTimeString()}`
            await Webos.window.setTitle(t)
            log(`setTitle: ${t}`)
          })}
        >
          改窗口标题
        </button>
        <button
          onClick={wrap(async () => {
            const info = await Webos.system.info()
            setSysInfo(info)
            log('已读 system.info')
          })}
        >
          读 system.info
        </button>
        <button
          onClick={wrap(async () => {
            const list = await Webos.apps.list()
            log(`apps: ${list.map((a) => a.appId).join(', ')}`)
          })}
        >
          列出应用
        </button>
        <button
          onClick={wrap(async () => {
            const t = await Webos.theme.current()
            await Webos.theme.set(t === 'dark' ? 'light' : 'dark')
            log('已切换主题')
          })}
        >
          切换主题
        </button>
        <button className="danger" onClick={() => void Webos.window.close()}>
          关闭自己
        </button>
      </section>

      {sysInfo && (
        <section className="card">
          <h2>系统信息</h2>
          <dl>
            {Object.entries(sysInfo).map(([k, v]) => (
              <div key={k} className="row">
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="card">
        <h2>调用日志</h2>
        <pre>{logs.join('\n') || '[等待操作]'}</pre>
      </section>
    </main>
  )
}
