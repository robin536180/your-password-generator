## Skill：expert-reviewer（评审）

目标：把“执行”与“评判”分离，用可操作的评审结论提前拦截偏差与质量风险。

### 两类评审

1. Plan Review（计划评审）
   - 评审对象：request_analysis/spec.md 与 tasks.md
   - 关注：目标/边界是否清晰；验收是否可验证；任务是否可控（1–3 动作）；风险与回退是否明确
2. Execution Review（执行评审）
   - 评审对象：代码改动 + coding_report_v1.md + 验证证据
   - 关注：是否偏离 Spec；是否引入不必要复杂度；是否有足够证据支持“通过”

### 评审输出（写入变更目录）

- request_analysis/review/spec_review_v1.md 或 coding/review/coding_review_v1.md
- 每条评审意见必须包含：问题描述、修改建议、优先级（MUST FIX / LOW / INFO）

### 评审决策

- APPROVED：允许进入下一阶段
- REVISION REQUIRED：必须回到上一阶段修订并提供新证据
