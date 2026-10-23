import type { SkillDocumentView, SkillView } from './types';

/**
 * The demo scenario has no upstream device to read a SKILL.md from, so the guide is
 * constructed locally. The same builder serves the observer API and the static
 * GitHub Pages build: the document is labelled as a demonstration and never
 * claims to be a real file on a device.
 */
export function demoSkillDocument(skill: SkillView): SkillDocumentView {
  return {
    skillId: skill.id,
    name: skill.name,
    revision: skill.revision,
    markdown: `---\nname: ${JSON.stringify(skill.name)}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n# ${skill.name}\n\n> 演示 SKILL.md：这是完整构造的示例文档，不代表真实设备上的技能文件。\n\n## 用途\n\n${skill.description || '展示技能的完整 Markdown 文档。'}\n\n## 工作流程\n\n1. 明确任务目标与输入资料。\n2. 根据资料组织处理步骤。\n3. 核对结果并交付可阅读的产物。\n\n## 输出要求\n\n- 说明结果与依据。\n- 保留尚待确认的信息。\n- 给出后续操作建议。\n\n## 示例\n\n\`\`\`text\n输入：一份待整理的资料\n输出：结构化结果及检查说明\n\`\`\`\n\n此示例只用于观察界面，不会执行技能或访问真实设备。\n`,
  };
}
