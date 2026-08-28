## Skill：request-analysis（需求分析）

目标：把“想法/需求”变成可执行、可验证、可回放的 Spec 与任务清单，避免目标漂移。

### 输入

- 用户需求描述
- [task_plan.md](file:///d:/IdeaProjects/final_5g/task_plan.md) 的目标/约束
- 现有发现与风险：[findings.md](file:///d:/IdeaProjects/final_5g/findings.md)
- request_analysis/spec.md
  - 目标（Core Goal）
  - 范围（In Scope / Out of Scope）
  - 验收口径（Acceptance）
  - 风险与未知（Risks & Unknowns）
  - 证据计划（Evidence Plan：如何验证）
- request_analysis/tasks.md
  - 1–3 个下一步动作（本轮允许的动作）
  - 每个动作的输入/输出、失败信号、回退点

### SOP

1. 先把需求复述成“可测量”的目标与边界（不写实现细节）
2. 明确本轮阶段目标（阶段完成 != 全局完成）
3. 写出验收口径与证据计划（禁止“我觉得好了”）
4. 将任务拆到 1–3 个动作，并定义失败回退路线
5. 进入执行前必须输出 checkpoint（当前理解、目标、下一步、风险、证据计划）

