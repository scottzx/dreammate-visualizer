import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SkillMarkdown, { splitSkillMarkdown } from '../src/view/SkillMarkdown';

test('Skill documents retain their complete frontmatter and untruncated Markdown body', () => {
  const body = `# 使用指南\n\n${'完整的正文。\n'.repeat(1500)}\n## 最后一节\n\n文档结尾。`;
  const markdown = `\uFEFF---\r\nname: reader\r\ndescription: 完整文档\r\n---\r\n${body}`;
  assert.deepEqual(splitSkillMarkdown(markdown), { frontmatter: 'name: reader\r\ndescription: 完整文档', body });
  const html = renderToStaticMarkup(createElement(SkillMarkdown, { markdown }));
  assert.ok(html.includes('文档元信息'));
  assert.ok(html.includes('name: reader'));
  assert.ok(html.includes('<h1>使用指南</h1>'));
  assert.ok(html.includes('<h2>最后一节</h2>'));
  assert.ok(html.includes('文档结尾。'));
  assert.equal((html.match(/完整的正文。/g) ?? []).length, 1500);
  assert.deepEqual(splitSkillMarkdown('# 无元信息\n\n正文'), { frontmatter: undefined, body: '# 无元信息\n\n正文' });
});

test('Skill Markdown renders lists, tables and code while treating document HTML as text', () => {
  const markdown = '# 指南\n\n- 条目\n\n| 输入 | 输出 |\n| --- | --- |\n| a | b |\n\n```sh\nprintf "hello"\n```\n\n<script>alert(1)</script>\n\n[外链](https://example.com/guide)\n\n[脚本](scripts/run.sh)\n\n[不安全](javascript:alert%281%29)';
  const html = renderToStaticMarkup(createElement(SkillMarkdown, { markdown }));
  assert.ok(html.includes('<li>条目</li>'));
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<pre><code class="language-sh">'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('href="https://example.com/guide" target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('文档引用：scripts/run.sh'));
  assert.ok(!html.includes('href="scripts/run.sh"'));
});
