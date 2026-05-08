/**
 * 类型安全的事件发射器
 * 基于 mitt 的设计理念，加 TS 泛型约束
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export type EventMap = Record<string, unknown>

export type EventHandler<T> = (payload: T) => void

export class EventEmitter<Events extends EventMap = EventMap> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<unknown>>>()

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as EventHandler<unknown>)
    return () => this.off(event, handler)
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>)
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrapped: EventHandler<Events[K]> = (payload) => {
      this.off(event, wrapped)
      handler(payload)
    }
    return this.on(event, wrapped)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    // 复制一份避免回调内 off 影响遍历
    for (const handler of [...set]) {
      try {
        handler(payload as unknown)
      } catch (err) {
        console.error(`[EventEmitter] handler error on "${String(event)}":`, err)
      }
    }
  }

  removeAllListeners(event?: keyof Events): void {
    if (event === undefined) {
      this.handlers.clear()
    } else {
      this.handlers.delete(event)
    }
  }

  listenerCount(event: keyof Events): number {
    return this.handlers.get(event)?.size ?? 0
  }
}
