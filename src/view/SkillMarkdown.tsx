import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function splitSkillMarkdown(markdown: string) {
  const source = markdown.replace(/^\uFEFF/, '');
  const metadata = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  return { frontmatter: metadata?.[1], body: metadata ? source.slice(metadata[0].length) : source };
}

export default function SkillMarkdown({ markdown }: { markdown: string }) {
  const { frontmatter, body } = splitSkillMarkdown(markdown);
  return <div className="skill-document">
    {frontmatter !== undefined && <details className="skill-document-metadata"><summary>文档元信息</summary><pre><code>{frontmatter}</code></pre></details>}
    <Markdown remarkPlugins={[remarkGfm]} components={{
      a: ({ href, children }) => href && /^https?:\/\//i.test(href)
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span className="skill-document-reference" title={href ? `文档引用：${href}` : undefined}>{children}</span>,
      img: ({ alt, src }) => <span className="skill-document-reference" title={typeof src === 'string' ? `图片引用：${src}` : undefined}>[图片{alt ? `：${alt}` : ''}]</span>,
      table: ({ children }) => <div className="skill-document-table"><table>{children}</table></div>,
    }}>{body}</Markdown>
  </div>;
}
