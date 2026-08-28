## 工作流门禁（Workflow Quality Gates）

本项目采用“结构化执行”：理解 → 规划 → 执行 → 验证。每一步都必须产出可验证的中间物。

### 10 阶段管道（10-Stage Pipeline）

1. 需求分析（request-analysis）
2. 需求评审（expert-reviewer / 人工确认点）
3. 编码实现（coding-skill）
4. 编码评审（expert-reviewer）
5. 测试编写（unit-test-write）
6. 测试评审（expert-reviewer）
7. 代码提交（如适用）
8. CI/静态检查验证（如适用）
9. 部署/运行验证（如适用，且不启动服务的前提下）
10. 用户确认（人工确认点）

### 循环上限（Iteration Cap）

- 需求评审：最多 3 轮
- 编码/测试评审：最多 2 轮
- 超过上限必须升级为“人工决策”：缩范围、改方案或暂停

### 回退路径（Rollback Routes）

- 发现需求偏差/验收口径不清：回退到阶段 1
- 发现方案设计不稳或边界不清：回退到阶段 2/3 的 checkpoint
- 发现验证失败（诊断/测试/静态检查）：回退到阶段 3/5

### 变更审计（Audit Trail）

任何会修改仓库内容的任务必须建立变更目录：

- 路径：.harness/changes/<type>_<name>_<YYYYMMDD>/
- summary.md：该变更的 Single Source of Truth
- 版本化评审产物：review 结论按 v1/v2…递增，旧版本不删除
