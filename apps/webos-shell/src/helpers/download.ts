/**
 * 触发浏览器下载
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export interface DownloadOptions {
  url?: string
  blob?: Blob
  data?: string | ArrayBuffer
  filename: string
  mimeType?: string
}

export function download(opts: DownloadOptions): void {
  let blobUrl: string | null = null

  try {
    let href: string

    if (opts.url) {
      href = opts.url
    } else if (opts.blob) {
      blobUrl = URL.createObjectURL(opts.blob)
      href = blobUrl
    } else if (opts.data !== undefined) {
      const blob = new Blob([opts.data], {
        type: opts.mimeType ?? 'application/octet-stream',
      })
      blobUrl = URL.createObjectURL(blob)
      href = blobUrl
    } else {
      throw new Error('download: 必须提供 url / blob / data 之一')
    }

    const a = document.createElement('a')
    a.href = href
    a.download = opts.filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // 延迟释放，避免下载未启动就被回收
    if (blobUrl) {
      setTimeout(() => URL.revokeObjectURL(blobUrl!), 1000)
    }
  }
}
