import type { CoverageStatus } from '../read-model/types';

export type JsonObject = Record<string, unknown>;
export const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const string = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;

export class SourceError extends Error {
  constructor(message: string, readonly status: CoverageStatus = 'unavailable') { super(message); }
}

export async function readJson(url: string, timeoutMs: number, init: RequestInit = {}): Promise<JsonObject> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error', headers: { accept: 'application/json', ...init.headers } });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SourceError(`HTTP ${response.status} · ${new URL(url).pathname}`, response.status === 401 || response.status === 403 ? 'forbidden' : response.status === 404 || response.status === 405 || response.status === 501 ? 'unsupported' : 'unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new SourceError('来源响应没有内容', 'partial');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new SourceError('来源响应超过 8 MiB，未完整读取', 'partial'); }
      chunks.push(part.value);
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new SourceError('来源响应不是 JSON 对象', 'partial');
    const data = result as JsonObject;
    if (data.isError === true || data.error) throw new SourceError('来源返回业务错误，未将错误解释为空结果', 'partial');
    return data;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError(controller.signal.aborted ? `读取超时（${timeoutMs} ms）` : error instanceof SyntaxError ? '来源返回无效 JSON' : '来源连接失败');
  } finally { clearTimeout(timer); }
}

export function failure(error: unknown): { status: CoverageStatus; message: string } {
  return { status: error instanceof SourceError ? error.status : 'unavailable', message: error instanceof Error ? error.message : '来源读取失败' };
}
