import { useEffect, useState } from 'react'
import { Webos, type User, type Theme } from '@webos/host-sdk'

export function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    Webos.user.current().then(setUser)
    Webos.theme.current().then(setTheme)
    const offUser = Webos.user.on('change', ({ user }) => setUser(user))
    const offTheme = Webos.theme.on('change', setTheme)
    return () => { offUser(); offTheme() }
  }, [])

  return (
    <div className={`app theme-${theme}`}>
      <header>
        <h1>__DISPLAY_NAME__</h1>
        <span className="meta">{user ? `已登录：${user.name}` : '未登录'} · 主题：{theme}</span>
      </header>
      <main>
        <p>这是一个由 <code>create-webos-app</code> 生成的 React + TS 应用（无 MUI）。</p>
        <div className="actions">
          <button onClick={() => Webos.notify({ title: 'Hello', level: 'success' })}>弹通知</button>
          <button onClick={async () => {
            const ok = await Webos.dialog.confirm('确认操作？')
            Webos.notify({ title: ok ? '已确认' : '已取消' })
          }}>Confirm</button>
          <button onClick={() => Webos.window.close()}>关闭窗口</button>
        </div>
      </main>
    </div>
  )
}
