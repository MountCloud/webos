/**
 * 可外部 resolve / reject 的 Promise
 * 适合"由其他代码控制结果"的场景，如等待用户操作完成
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

export class TeePromise<T = void> implements Promise<T> {
  readonly [Symbol.toStringTag] = 'TeePromise'

  resolve!: (value: T | PromiseLike<T>) => void
  reject!: (reason?: unknown) => void

  private readonly _promise: Promise<T>

  constructor() {
    this._promise = new Promise<T>((res, rej) => {
      this.resolve = res
      this.reject = rej
    })
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this._promise.finally(onfinally)
  }
}
