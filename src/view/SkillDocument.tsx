import { useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import type { DataMode, SkillDocumentView, SkillView } from '../read-model/types';
import { demoSkillDocument } from '../read-model/demo-skill';
import { STANDALONE_DEMO } from './deployment';
import SkillMarkdown from './SkillMarkdown';

type DocumentState = { status: 'loading' } | { status: 'ready'; document: SkillDocumentView } | { status: 'error'; message: string; directoryChanged: boolean };

export default function SkillDocument({ mode, serviceId, skill, onRefresh }: {
  mode: DataMode; serviceId: string; skill: SkillView; onRefresh: () => void;
}) {
  const [state, setState] = useState<DocumentState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode === 'demo' && STANDALONE_DEMO) {
      // No backend on GitHub Pages: the demo guide is generated locally.
      setState({ status: 'ready', document: demoSkillDocument(skill) });
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ mode, serviceId, skillId: skill.id });
    if (skill.revision) query.set('revision', skill.revision);
    setState({ status: 'loading' });
    void (async () => {
      try {
        const response = await fetch(`/api/skill?${query}`, { signal: controller.signal, cache: 'no-store' });
        const document: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const message = document && typeof document === 'object' && 'error' in document && typeof document.error === 'string'
            ? document.error : `文档读取失败（HTTP ${response.status}）`;
          setState({ status: 'error', message, directoryChanged: response.status === 409 });
          return;
        }
        if (!document || typeof document !== 'object' || !('markdown' in document) || typeof document.markdown !== 'string'
          || !('skillId' in document) || document.skillId !== skill.id) throw new Error('来源返回的 Skill 文档格式不匹配');
        setState({ status: 'ready', document: document as SkillDocumentView });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : '无法读取 Skill 文档', directoryChanged: false });
      }
    })();
    return () => controller.abort();
  }, [mode, serviceId, skill.id, skill.revision, attempt]);

  return <section className="skill-document-details" aria-label="Skill 完整文档">
    <div className="detail-heading"><h3>{skill.name}</h3>{mode === 'demo' && <p>演示文档</p>}</div>
    {state.status === 'loading' ? <p className="skill-document-status" role="status"><LoaderCircle size={15} className="spinning" />正在读取完整 Skill 文档…</p>
      : state.status === 'ready' ? <SkillMarkdown markdown={state.document.markdown} />
        : <div className="skill-document-error" role="alert"><p>完整文档暂时无法读取：{state.message}</p>
          <button className="button" onClick={() => state.directoryChanged ? onRefresh() : setAttempt(value => value + 1)}><RefreshCw size={13} />{state.directoryChanged ? '刷新技能目录' : '重新读取'}</button>
          {skill.description.trim() && <div className="skill-document-fallback"><strong>目录概要</strong><p className="skill-description">{skill.description}</p></div>}
        </div>}
  </section>;
}
