import 'server-only'

// Next's Node adapter can expose a stream even for an empty POST. Verify EOF, never trust Content-Length alone.
export function createDiagnosticRouteAdapter(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST' || request.body === null || request.bodyUsed || request.signal.aborted
      || request.headers.has('content-type') || request.headers.has('content-encoding')
      || request.headers.has('transfer-encoding')
      || (request.headers.has('content-length') && request.headers.get('content-length') !== '0')) return handler(request)
    let timer: ReturnType<typeof setTimeout> | undefined
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      reader = request.body.getReader()
      const empty = await Promise.race([
        reader.read().then(chunk => chunk.done === true),
        new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 250) }),
      ])
      if (!empty || request.signal.aborted) return handler(request)
      return handler(new Request(request.url, { method: request.method, headers: request.headers, signal: request.signal }))
    } catch { return handler(request) }
    finally {
      if (timer) clearTimeout(timer)
      if (reader) void reader.cancel().catch(() => {})
    }
  }
}
