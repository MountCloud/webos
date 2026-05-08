# WebOs

A universal Web desktop platform.

简体中文：[README_CN](./README_CN.md)

## License

Must be the beloved **MIT** License. See [LICENSE](./LICENSE) for details.

# Applications

Any Web application becomes a "desktop runtime + full SDK", allowing apps built with Vue / React / jQuery / plain HTML (or any tech stack) to run as **windows** on the WebOS desktop. Through `@webos/host-sdk`, they can access desktop-level capabilities such as notifications, dialogs, cross-app messaging, theming, storage, deep linking, and more.

---

## One-Click Start (Recommended)

```bash
pnpm install        # Install all workspace dependencies
pnpm dev:all        # Start webos shell + 4 Vite examples simultaneously
```

Once running, the browser will automatically open <http://localhost:5173>.

Ports used:

| Port | Service                        | Description                          |
|------|--------------------------------|--------------------------------------|
| 5173 | webos shell                    | Main desktop program                 |
| 5501 | example-vanilla-js-vite        | Example 02                           |
| 5502 | example-vue-js                 | Example 03                           |
| 5503 | example-react-ts               | Example 04                           |
| 5504 | example-react-mui              | Example 06 (Recommended for production) |

Examples 01 (Vanilla HTML) and 05 (jQuery) are static pages hosted directly by the webos shell dev server at `/examples/01-vanilla-html/` and `/examples/05-jquery-legacy/`, so they don't occupy additional ports.

---

## What You Can Do on the Desktop

After opening <http://localhost:5173>, you will see:

- **Top-left pill**: `▌▌` Show desktop (minimize all windows / click again to restore) · `⚫⚫` Main menu (full-screen launcher with app name filtering)
- **Centered floating dock at the top**: List of running windows — click to switch / click again to minimize / right-click to close
- **Top-right pill**: `🔔` Notification center · `👤` User menu (placeholder) · `⚙` Settings panel (theme / icon size / language) · `🔍` Global search (Cmd/Ctrl + K)
- **Desktop icons** (vertical on the left): 8 example apps + built-in demos for dialog/notify

Try these operations (best way to experience the features):

1. **`Cmd/Ctrl + K`** → type `event` → select "**Event List - React + MUI Example**" → directly opens the events page inside the React app (deep linking + sub-feature registration demo)
2. Double-click multiple example icons → check running windows in the dock → drag title bar to move / drag edges to resize / double-click title bar to maximize
3. Click ⚙ in top-right → switch between dark/light theme — **the entire desktop and all iframe apps change color simultaneously** (including MUI apps via `@webos/mui-theme`)
4. Click ⚙ → Desktop Icons → Small / Medium / Large — icons resize in real time and persist after refresh
5. Double-click the 🌐 "**Open in New Tab**" icon → opens in a **new browser tab** (demonstrates `launchMode: 'tab'`)
6. In the React+MUI example, click "**Custom Buttons dialog.show**" → shows a dialog with three custom buttons + Esc/Enter key support

---

## Start Individually

```bash
pnpm dev                                  # Start only webos shell
pnpm --filter example-react-mui dev       # Start React+MUI example only
pnpm --filter example-vue-js dev          # Start Vue example only
pnpm dev:examples                         # Start all Vite examples (without shell)
```

---

## Scaffold a New App (CLI)

Use the `create-webos-app` CLI to generate a new webos application from one of 8 templates:

```bash
# Interactive
npm create webos-app
# or
pnpm create webos-app

# Non-interactive
npx create-webos-app my-app -t react-mui-js
npx create-webos-app my-app --template vue-js
```

Available templates:

| ID | Stack |
|----|-------|
| `react-mui-js` ⭐ | React + MUI + WebosThemeProvider · JavaScript (production-recommended) |
| `react-mui-ts` | Same as above, but with TypeScript |
| `react-js` / `react-ts` | React without MUI |
| `vue-js` | Vue 3 + Composition API |
| `vanilla-js` | Vanilla JS + Vite |
| `vanilla-html` | Pure HTML + UMD CDN, zero build |
| `jquery` | jQuery + UMD (legacy projects) |

See [`packages/create-webos-app/README.md`](./packages/create-webos-app/README.md) for details.

---

## Build

```bash
pnpm build                # Build entire workspace for production
pnpm build:shell          # Build only webos shell
pnpm build:packages       # Build only npm packages (@webos/host-sdk, @webos/mui-theme)
```

---

## Directory Structure

```
osweb/
├── apps/
│   └── webos-shell/             # Desktop shell (TS + Vite, main program)
├── packages/
│   ├── host-sdk/                # @webos/host-sdk —— Universal SDK for any tech stack
│   ├── mui-theme/               # @webos/mui-theme —— Theme adapter for React + MUI apps
│   └── create-webos-app/        # CLI scaffolder (8 templates)
├── examples/
│   ├── 01-vanilla-html/         # Pure HTML + UMD CDN, zero build
│   ├── 02-vanilla-js-vite/      # Vanilla JS + Vite
│   ├── 03-vue-js/               # Vue 3 + JS
│   ├── 04-react-ts/             # React 18 + TypeScript
│   ├── 05-jquery-legacy/        # jQuery + UMD (painless integration for legacy projects)
│   └── 06-react-mui/            # ⭐ React + MUI + WebosThemeProvider (Recommended for production)
├── docs/
│   ├── HOST_SDK_API.md          # Complete SDK API reference
│   ├── APP_DEVELOPER_GUIDE.md   # App development guide (multi-stack integration)
│   ├── APP_MANIFEST_SPEC.md     # Manifest specification (entries multi-entry + contributes)
│   ├── MUI_INTEGRATION.md       # React + MUI integration guide
│   ├── ARCHITECTURE.md          # Architecture overview
│   ├── THEME_DEVELOPER_GUIDE.md # Theme development guide
│   ├── DESIGN.md                # Detailed module design
│   ├── TECH_STACK.md            # Technology stack choices
│   └── LEARNING_NOTES.md        # Design review notes
├── README.md                    # This file
├── NOTICE.md                    # Acknowledgments and license attribution
└── osweb-plan.md                # Project plan and task list
```

---

## Core Features

### Main Program (webos shell)

- Multi-window management (drag / resize / maximize / minimize / close)
- Desktop + top bar (left & right pills) + centered floating dock
- Full-screen launcher main menu (Ubuntu / Synology DSM style)
- Global search (Cmd/Ctrl + K) — grouped by apps / sub-features / commands
- Notification center + toast notifications (4 levels, max 5 stacked)
- Dialogs (alert / confirm / prompt / **custom buttons via dialog.show**)
- Context menus (multi-level nested)
- Theme (light / dark / system) + icon size (small / medium / large) + i18n (English/Chinese)

### `@webos/host-sdk` (App Integration)

```ts
import { Webos } from '@webos/host-sdk'

await Webos.notify({ title: 'Saved successfully', level: 'success' })
const ok = await Webos.dialog.confirm({
  message: 'Permanently delete?', confirmText: 'Delete', danger: true
})
await Webos.window.setSize(800, 600)
await Webos.window.setTitle('Untitled - document.txt')
const info = await Webos.app.bootInfo()        // { appId, feature?, params? }
Webos.events.on('app.navigate', ({ feature, uri }) => router.push(uri))

// User identity / token — shared across apps. Once written on the login page, all apps can access it immediately.
const user = await Webos.user.current()
const accessToken = await Webos.user.accessToken()
Webos.user.on('change', ({ user }) => {
  if (!user) location.href = '/login.html'
})
```

Full API reference: [docs/HOST_SDK_API.md](./docs/HOST_SDK_API.md)

#### Same-origin Login Page

For login pages under the **same origin** (same protocol + domain + port), you can use the pure function from the SDK to write directly to localStorage **without RPC**:

```ts
import { writeWebosSession } from '@webos/host-sdk'

writeWebosSession({
  user: { id, name, email, permissions },
  token: { accessToken, refreshToken,
           expiresAt: Date.now() + expiresIn * 1000 },
})
location.href = '/'   // Jump to webos
```

On startup, `UserSession` automatically restores from the same localStorage key. The **login page / RPC calls / shell internals** all use the same persistence layer — single source of truth.

### `@webos/mui-theme` (Dedicated for React + MUI apps)

```tsx
import { WebosThemeProvider } from '@webos/mui-theme'

<WebosThemeProvider>
  <App />
</WebosThemeProvider>
```

One line of Provider makes your MUI theme follow the webos desktop light/dark mode. See [docs/MUI_INTEGRATION.md](./docs/MUI_INTEGRATION.md) for details.

---

## Register Sub-features

Declare them under `entries[i].features` so global search can jump directly to specific pages inside your app:

```json
{
  "appId": "com.acme.crm",
  "name": "CRM",
  "entries": [
    {
      "id": "main",
      "name": "CRM",
      "icon": "...",
      "uri": "https://crm.acme.com/",
      "features": [
        {
          "id": "new-customer",
          "name": "New Customer",
          "uri": "/customers/new",
          "keywords": ["new", "customer", "create"]
        },
        {
          "id": "reports",
          "name": "Sales Report",
          "uri": "/reports",
          "category": "Reports"
        }
      ]
    }
  ]
}
```

User types "new customer" in search → selects it → CRM launches and directly navigates to `/customers/new`. If CRM is already running, it won't reload; the desktop shell sends an `app.navigate` event which the SPA router handles. See [docs/APP_MANIFEST_SPEC.md](./docs/APP_MANIFEST_SPEC.md) for details.

---

## Launch Modes

Each entry can specify `launchMode` (under `entries[i]`) in the manifest:

| Mode       | Behavior                                      | Use Case                              |
|------------|-----------------------------------------------|---------------------------------------|
| `window` (default) | Runs inside an iframe window with full SDK access | Standard business applications       |
| `tab`      | Opens in a new browser tab via `window.open`  | Large-screen BI / SSO entry / pages that refuse X-Frame embedding |

---

## Screenshots

### Homepage

![Welcome](readme/欢迎.jpg)

### Multi-window & SDK

![Welcome](readme/多窗口.jpg)

### System Settings

![Welcome](readme/系统设置.jpg)

### Search

![Welcome](readme/搜索.jpg)

### Main Menu

![Welcome](readme/主菜单.jpg)