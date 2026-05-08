/**
 * Webos.upload / Webos.download
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import type { RpcClient } from '../core/RpcClient'

export interface DownloadOptions {
  url: string
  filename?: string
}

export interface UploadOptions {
  url: string
  files: File[]
  fieldName?: string
  headers?: Record<string, string>
  onProgress?: (loaded: number, total: number) => void
}

export interface UploadResult {
  ok: boolean
  status: number
  body?: string
}

export function createDownload(rpc: RpcClient) {
  return function download(options: DownloadOptions): void {
    void rpc.call('download', 'trigger', options)
  }
}

// upload 在 SDK 这一侧直接做（不必走桌面壳），因为 fetch 在 iframe 内可用
// 但为了视觉统一，可以让桌面壳同步显示进度（V2 再做）
export function createUpload(_rpc: RpcClient) {
  return async function upload(options: UploadOptions): Promise<UploadResult> {
    const form = new FormData()
    const field = options.fieldName ?? 'file'
    for (const f of options.files) {
      form.append(field, f, f.name)
    }
    const xhr = new XMLHttpRequest()
    return new Promise<UploadResult>((resolve, reject) => {
      xhr.open('POST', options.url)
      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) xhr.setRequestHeader(k, v)
      }
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && options.onProgress) {
          options.onProgress(e.loaded, e.total)
        }
      })
      xhr.addEventListener('load', () => {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText })
      })
      xhr.addEventListener('error', () => reject(new Error('upload network error')))
      xhr.send(form)
    })
  }
}
