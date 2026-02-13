# BarberBook Pro 系统设计说明书

## 1. 系统概述
BarberBook Pro 是一个现代化的理发店预约管理系统，旨在解决传统电话预约效率低、排队混乱的问题。系统集成了在线预约、扫码签到、排队可视化以及 AI 发型咨询等功能。

## 2. 技术架构

### 2.1 前端技术栈
- **核心框架**: React 19
- **样式方案**: Tailwind CSS
- **图标库**: Lucide React
- **工具库**: 
  - `date-fns`: 日期与时间处理
  - `qrcode` / `jsqr`: 二维码生成与解析
  - `@google/genai`: AI 功能集成 (Gemini 2.5/3 系列)

### 2.2 数据存储架构
系统采用“双模适配器”模式 (`StorageService`)，支持无缝切换：
1.  **LocalStorage (默认)**: 
    - 适合演示、单机测试或轻量级使用。
    - 数据保存在用户浏览器本地，无需后端部署。
2.  **Supabase (扩展)**: 
    - 通过配置 API URL 和 Key 连接 PostgreSQL 数据库。
    - 支持多端数据同步、持久化存储。

### 2.3 目录结构
- `/components`: UI 组件 (BookingFlow, AdminPanel, QRScanner, ScheduleDashboard 等)
- `/services`: 业务逻辑封装
  - `storageService.ts`: 数据持久化适配层
  - `geminiService.ts`: AI 接口封装
- `/types`: TypeScript 类型定义
- `/doc`: 项目文档及数据库脚本

## 3. 核心模块设计

### 3.1 预约模块 (BookingFlow)
- **流程**: 
  1. 选择理发师 (Barber Selection)
  2. 选择日期 (Date Selection) - 仅限未来7天，自动过滤节假日。
  3. 选择时间段 (Time Slot Selection) - 根据营业时间和已占用情况动态生成，自动禁用过去的时间。
  4. 填写信息 (Customer Info) - 姓名、电话。
  5. 确认与凭证 (Confirmation) - 生成唯一预约 ID 及二维码。
- **约束规则**: 
  - 每日每位理发师最大服务人数限制 (`maxSlotsPerBarberPerDay`)。
  - 理发师维度的并发控制。

### 3.2 签到与排队模块 (QRScanner & Dashboard)
- **扫码签到逻辑**: 
  - 系统识别预约二维码。
  - **前序校验**: 检查该理发师当日在该时间段之前是否有未完成 (`BOOKED`) 的预约。
  - 若存在未完成的前序预约，系统拦截签到并提示“前方还有顾客未完成”。
  - 校验通过后，更新状态为 `COMPLETED` 并释放资源。
- **排队看板**:
  - 实时展示当日每位理发师的预约队列。
  - 视觉区分当前服务对象（高亮）、已完成对象（绿色）和候补对象（灰色）。

### 3.3 AI 顾问 (AIAdvisor)
- 利用 Google Gemini 模型，根据用户自然语言描述（如脸型、发质、职业场景）提供个性化的发型建议。

### 3.4 后台管理 (AdminPanel)
- **系统配置**: 动态设置营业时间、服务时长、最大客流。
- **理发师管理**: 支持新增、编辑、删除理发师。
  - **图片处理**: 实现前端图片压缩（Canvas），限制最大尺寸为 300px，防止 Base64 字符串过大影响性能。
- **数据管理**: 预约记录查询与取消。

## 4. 数据模型

### 4.1 Barber (理发师)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | string | UUID |
| name | string | 姓名 |
| specialty | string | 专长 |
| avatarUrl | string | 头像 (Base64 或 URL) |
| bio | string | 简介 |

### 4.2 Appointment (预约)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | string | UUID |
| barberId | string | 关联 Barber ID |
| date | string | 预约日期 (YYYY-MM-DD) |
| timeSlot | string | 时间段 (HH:mm) |
| status | enum | BOOKED, COMPLETED, CANCELLED |
| customerName | string | 客户姓名 |
| customerPhone| string | 客户电话 |
| timestamp | number | 创建时间戳 |

### 4.3 SystemSettings (系统设置)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| maxSlotsPerBarberPerDay | number | 单日最大接客量 |
| openingTime | string | 开门时间 |
| closingTime | string | 关门时间 |
| slotDurationMinutes | number | 单次服务时长 |
