import type { ObserverConfig } from '../observer/config';
import { baseUrl } from '../observer/config';
import type { ObserverSnapshot, SkillDocumentView } from '../read-model/types';
import { demoSkillDocument } from '../read-model/demo-skill';
import { object, readJson, string, type JsonObject } from './http';

export class SkillDocumentError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 503) { super(message); }
}

export interface SkillDocumentRequest { serviceId: string; skillId: string; revision?: string }
const guideEntries = new Set(['SKILL.remote.md', 'skill.remote.md', 'SKILL.md', 'skill.md']);
const revisionPattern = /^[a-f0-9]{64}$/;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function readGuide(url: string, timeoutMs: number): Promise<JsonObject> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json' } });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) throw new SkillDocumentError('该 Skill 已不存在，请刷新能力目录。', 404);
      if (response.status === 409) throw new SkillDocumentError('Skill 版本或来源已变化，请刷新能力目录后重试。', 409);
      throw new SkillDocumentError('Skill 文档来源暂时不可用。', 503);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new SkillDocumentError('Skill 文档来源没有返回内容。', 503);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SkillDocumentError('Skill 文档响应超过读取上限，未展示不完整正文。', 503);
      }
      chunks.push(part.value);
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data) || object(data).error || object(data).isError === true)
      throw new SkillDocumentError('Skill 文档来源返回无效结果。', 503);
    return object(data);
  } catch (error) {
    if (error instanceof SkillDocumentError) throw error;
    throw new SkillDocumentError(controller.signal.aborted ? 'Skill 文档读取超时，请稍后重试。' : 'Skill 文档来源暂时不可用。', 503);
  } finally { clearTimeout(timer); }
}

/** Only a visible catalogue entry can select a guide. No caller-controlled path, resource or method. */
export async function readSkillDocument(snapshot: ObserverSnapshot, config: Pick<ObserverConfig, 'timeoutMs'>, request: SkillDocumentRequest): Promise<SkillDocumentView> {
  const service = snapshot.services.find(item => item.id === request.serviceId);
  const skill = service?.skills.find(item => item.id === request.skillId);
  if (!service || !skill) throw new SkillDocumentError('该 Skill 不在当前可见目录中。', 404);
  if (request.revision !== undefined && request.revision !== skill.revision)
    throw new SkillDocumentError('Skill 版本已变化，请刷新能力目录后重试。', 409);

  if (snapshot.mode === 'demo') return demoSkillDocument(skill);

  const node = snapshot.nodes.find(item => item.id === service.nodeId);
  if (service.nativeId !== 'dreammate-skill-manager' || !node?.catalogAvailable || !node.observedAt)
    throw new SkillDocumentError('该服务尚未提供可读取的 Skill 文档协议。', 503);
  if (!skill.id || skill.id.length > 256 || skill.id.includes('\0'))
    throw new SkillDocumentError('Skill 目录标识无效，请刷新能力目录。', 503);
  if (skill.revision !== undefined && !revisionPattern.test(skill.revision))
    throw new SkillDocumentError('Skill 目录版本无效，请刷新能力目录。', 503);
  let origin: string;
  try { origin = baseUrl(node.address); }
  catch { throw new SkillDocumentError('Skill 所属设备缺少有效的已观测网关。', 503); }

  let manifest: JsonObject;
  try { manifest = await readJson(`${origin}/manifest`, config.timeoutMs); }
  catch { throw new SkillDocumentError('Skill 所属设备暂时不可达。', 503); }
  if (string(manifest.node_id) !== node.nativeId)
    throw new SkillDocumentError('Skill 所属设备身份已变化，请刷新能力目录。', 409);
  if (!Array.isArray(manifest.services) || !manifest.services.some(item => string(object(item).id) === service.nativeId))
    throw new SkillDocumentError('Skill 文档服务当前不可用。', 503);

  const query = skill.revision ? `?revision=${encodeURIComponent(skill.revision)}` : '';
  const data = await readGuide(`${origin}/skills/${encodeURIComponent(skill.id)}${query}`, config.timeoutMs);
  if (data.id !== skill.id) throw new SkillDocumentError('Skill 文档身份不匹配，未展示正文。', 409);
  if (typeof data.revision !== 'string' || !revisionPattern.test(data.revision))
    throw new SkillDocumentError('Skill 文档缺少有效版本，未展示正文。', 503);
  if (skill.revision && data.revision !== skill.revision)
    throw new SkillDocumentError('Skill 版本已变化，请刷新能力目录后重试。', 409);
  if (!guideEntries.has(string(data.resource)) || data.encoding !== 'utf8' || typeof data.content !== 'string' || !data.content || data.truncated === true)
    throw new SkillDocumentError('Skill 来源未返回完整的 Markdown 指南。', 503);
  return { skillId: skill.id, name: string(data.name, skill.name), revision: data.revision, markdown: data.content };
}
