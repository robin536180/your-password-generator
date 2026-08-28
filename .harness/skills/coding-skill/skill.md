## Skill：coding-skill（编码实现）

目标：在不破坏既有功能的前提下，以最小改动完成 Spec，并把验证证据与回放信息沉淀到变更目录。

### 前置门禁（Pre-conditions）

- 已有 request_analysis/spec.md 与 tasks.md
- 已输出 checkpoint，并明确本轮只做 1–3 个动作

### 执行准则

- 优先复用既有模式与依赖，不凭空引入新框架
- 改动面越大，越需要拆分为多轮变更
- 任何外部依赖引入必须在变更目录记录校验依据与版本选择理由

### 输出（写入变更目录）

- coding/coding_report_v1.md
  - 改了什么（diff 摘要）
  - 为什么这么改（与 Spec 对齐点）
  - 风险与回退（Rollback）
- coding/review/coding_review_v1.md（可先留空，待评审补齐）

### 后置门禁（Post-conditions）

- 通过至少一种“外部证据”验证：诊断/测试/可运行脚本输出
- 把结果与遗留问题回写到 summary.md（Reverse Sync）
