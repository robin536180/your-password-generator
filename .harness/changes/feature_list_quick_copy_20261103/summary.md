# 变更摘要：项目列表内一键复制用户名 / 密码

- **变更编号**：feature_list_quick_copy_20261103
- **类型**：功能增强（feature）
- **创建时间**：2026-11-03
- **状态**：✅ 已完成（typecheck / build / vitest 三验通过，待用户真机验收）

## 1. 需求

在项目列表中，每个项目无需打开编辑抽屉即可直接复制用户名与密码。

## 2. 实现要点

| 关注点 | 做法 |
|---|---|
| 字段定位 | 优先 `purpose`（primary_username / primary_password），其次类型（email / password），最后按中英文标签正则匹配 |
| 误判规避 | 用户名排除 password / concealed / otp 类型；密码排除 otp 类型（避免复制到 `otpauth://` URI） |
| 交互 | 列表行右侧新增两个图标按钮（用户 / 钥匙），点击复制并弹出 Toast，1.5s 内显示对勾 |
| 安全 | 沿用密码字段策略：复制 20 秒后清空剪贴板；仅非回收站项目显示按钮 |
| 缺失处理 | 项目没有对应字段时不渲染按钮，保持列表干净 |

## 3. 文件清单

| 文件 | 变更 | 说明 |
|---|---|---|
| `src/screens/HomeScreen.tsx` | 修改 | 新增 `pickUsernameValue` / `pickPasswordValue` 与 `copyValue`，列表行增加两个复制按钮 |

## 4. 验收证据

- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `npx vitest run` → 6 文件 **51/51 通过**（无回归）

## 5. 影响面

- HomeScreen 同时被 popup 与 Options 复用，两处入口自动获得该能力。
- 未改动字段结构、存储格式与 IPC 协议，无数据兼容性风险。
