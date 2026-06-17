# 驿马光年 Web 版

与 iOS App **共用同一 Supabase 数据库**，代码在 `web-app/` 目录，**不修改** App 源码。

## 功能对照（与 App 一致）

| 模块 | 功能 |
|------|------|
| 登录 | 相同用户名/密码，相同权限（普通用户 / 管理员 / 超级管理员） |
| 租赁订单 | 列表、搜索、日期筛选、新建、详情、编辑、归还、删除 |
| OA 提报 | 维修/采购、审批、执行确认、超级管理员编辑删除 |
| 器材管理 | 分类、搜索、总览、可租/已租出/维护中筛选、增删改、文件夹、套餐 |
| 收银台 | 年份/付款状态筛选、录入付款、改总价、订单备注（管理员） |
| 人员信息 | 客户、跟机员、介绍人 CRUD（管理员） |
| 营业统计 | 营收/订单/资料统计，导出 TXT/CSV（管理员） |
| 管理员管理 | 创建账号、设管理员、删账号（超级管理员） |
| 扫码 | 选器材时摄像头扫码（需 HTTPS 或 localhost） |
| 密码门 | 非管理员敏感操作需输入 `020114` |

## 本机运行

```bash
# 1. 安装 Node.js LTS：https://nodejs.org

# 2. 进入目录
cd "/Volumes/Likai 4TB/器材租赁记账软件开发/器材租赁记账 Cursor UI 金属/web-app"

# 3. 安装依赖
npm install

# 4. 配置 .env（通常已有，与 SupabaseConfig.swift 相同）
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# 5. 启动
npm run dev
```

浏览器打开 http://localhost:5173 ，用 App 相同账号登录。

## 常用命令

```bash
npm run dev      # 开发
npm run build    # 打包
npm run preview  # 预览打包结果
```

## 部署（Vercel）

1. 将 `web-app` 推送到 GitHub
2. 在 https://vercel.com 导入仓库，Root Directory 设为 `web-app`
3. 环境变量添加 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
4. 部署后获得公网地址

## 与 App 的差异

| 项目 | Web | App |
|------|-----|-----|
| 推送通知 | 无（可后续加浏览器通知） | iOS 推送 |
| 器材图片 | 暂无内置 Assets 图 | App 内打包图片 |
| 界面主题 | 统一简洁 Web 风格 | 多种金属/玻璃主题 |
| 共用图片分组 | 仅编码字段同步 | 需 Xcode Assets 放图 |

业务数据、库存计算、OA 维护逻辑、付款记录均与 App 共用云端数据。

## 目录结构

```
web-app/src/
├── services/dataStore.ts    # 业务核心（对应 iOS DataManager）
├── context/                 # Auth + Data
├── lib/                     # 工具、库存算法、导出
├── components/              # 共用组件、扫码、选器材
└── pages/                   # 各功能页面
```
