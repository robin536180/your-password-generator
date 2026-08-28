## .harness：Index & Map

本目录用于把 AI Agent 的“非确定性”纳入工程化控制面：约束（Constraints）、反馈闭环（Feedback Loops）、流程编排（Workflow Orchestration）与持续改进（Continuous Improvement）。

### L1（常驻上下文 / Always Loaded）

- 项目计划与发现
  - [task_plan.md](file:///d:/IdeaProjects/final_5g/task_plan.md)
  - [findings.md](file:///d:/IdeaProjects/final_5g/findings.md)
  - [progress.md](file:///d:/IdeaProjects/final_5g/progress.md)
- Agent 角色定义
  - [application_owner.md](file:///d:/IdeaProjects/final_5g/.harness/agents/application_owner.md)
- 规则（不变式与流程门禁）
  - [invariants.md](file:///d:/IdeaProjects/final_5g/.harness/rules/invariants.md)
  - [workflow.md](file:///d:/IdeaProjects/final_5g/.harness/rules/workflow.md)

### L2（按阶段加载 / Phase-triggered）

- 需求分析阶段：skills/request-analysis
  - [skill.md](file:///d:/IdeaProjects/final_5g/.harness/skills/request-analysis/skill.md)
- 编码实现阶段：skills/coding-skill
  - [skill.md](file:///d:/IdeaProjects/final_5g/.harness/skills/coding-skill/skill.md)
- 评审阶段：skills/expert-reviewer
  - [skill.md](file:///d:/IdeaProjects/final_5g/.harness/skills/expert-reviewer/skill.md)
- 测试阶段：skills/unit-test-write
  - [skill.md](file:///d:/IdeaProjects/final_5g/.harness/skills/unit-test-write/skill.md)

### L3（按需查询 / On-demand）

- 项目 Wiki（领域知识、数据口径、架构图等）：.harness/wiki/
- 外部工具配置（如 MCP Servers）：.harness/mcp/

### 变更审计（Audit Trail）

每个需求/实验在 .harness/changes/ 下创建一个变更目录，沉淀可回放的证据链与版本化评审产物：

- 创建：python scripts/harness_new_change.py --type feature --name <slug>
- 入口：变更目录的 summary.md 为该变更的 Single Source of Truth
