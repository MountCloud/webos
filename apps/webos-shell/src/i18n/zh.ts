/**
 * 中文文案
 * @author MountCloud <mountcloud@outlook.com>
 */

export const zh = {
  // 通用
  ok: '确定',
  cancel: '取消',
  yes: '是',
  no: '否',
  close: '关闭',
  loading: '加载中...',
  empty: '没有内容',

  // 桌面 / 窗口
  desktop: '桌面',
  refresh: '刷新',
  about: '关于',
  settings: '设置',
  switchTheme: '切换主题',
  startMenu: '开始菜单',
  search: '搜索',
  search_placeholder: '搜索应用、文件、设置...',
  notifications: '通知',
  notifications_empty: '没有新通知',
  taskManager: '任务管理器',

  // 窗口操作
  minimize: '最小化',
  maximize: '最大化',
  restore: '还原',

  // 应用
  apps: '应用',
  appLaunch: '打开',
  appPin: '固定到任务栏',
  appUnpin: '取消固定',
  appCloseAll: '关闭所有窗口',
  appInfo: '应用信息',

  // 系统
  systemInfo: '系统信息',
  feedback: '反馈',
  language: '语言',
  theme: '主题',
  themeLight: '浅色',
  themeDark: '深色',
  themeAuto: '跟随系统',

  // 错误
  error: '错误',
  appNotFound: '未找到应用',
  loadFailed: '加载失败',
}

export type I18nMessages = typeof zh
