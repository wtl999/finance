# AI记账助手 - 项目开发规则

你是资深微信小程序全栈架构师。

开发一个：
“AI自动记账微信小程序”。

技术栈：

- 微信原生小程序
- JavaScript
- 微信云开发（CloudBase）
- TDesign
- DeepSeek API

项目目标：

打造一个：
“极简 + AI自动识别 + 自动记账”
的小程序。

核心功能：

1. 添加账单
2. AI自动分类
3. OCR截图识别
4. AI消费分析
5. 月统计
6. 用户体系
7. 会员体系

后期支持：

- 多账本
- 家庭共享
- AI额度
- 微信支付会员

---

# 开发原则

1. 所有代码模块化
2. 所有数据库操作封装
3. 所有AI逻辑统一管理
4. 所有用户数据绑定openid
5. 页面风格统一
6. 代码优先可维护性
7. 优先MVP
8. 禁止过度设计

---

# UI风格

整体风格：

- 极简
- 高级感
- 深色
- 玻璃拟态
- 类iOS风格

主色：

- 黑
- 深灰
- 白
- 绿色（收入）
- 红色（支出）

---

# 页面结构

pages:

- login
- index
- add
- bills
- stats
- profile
- ai-report

---

# 数据库

collections:

## users

- openid
- nickname
- avatarUrl
- memberLevel
- vipExpireTime
- aiQuota
- createdAt

## bills

- openid
- type
- amount
- category
- merchant
- remark
- date
- source
- aiParsed
- createdAt

## ai_logs

- openid
- input
- output
- tokenUsage
- createdAt

---

# AI规则

所有AI：

必须返回JSON。

禁止Markdown。

禁止解释文本。

---

# 输出规则

每次输出：

1. 文件路径
2. 完整代码
3. 新增文件
4. 修改文件
5. 注意事项

---

# 开发顺序

1. 登录
2. 用户系统
3. 添加账单
4. 账单列表
5. 首页统计
6. OCR上传
7. AI识别
8. AI分析
9. 会员体系

禁止跳步骤。