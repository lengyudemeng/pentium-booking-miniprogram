# 奔腾预约微信小程序

一个基于微信云开发的预约小程序，支持：

- 用户预约每周六 `19:00-20:00` / `20:00-21:00`
- 收集预约类型、姓名、手机号、预约需求
- 用户查看和取消自己的预约
- 服务人员查看自己分组的预约并结单
- 管理员审批服务人员、分配分组、配置学期轮值、控制某日是否开放预约

## 安全与合规整改

### 1. 隐私合规

已补充：

- 《隐私政策》页面：`miniprogram/pages/privacy/privacy`
- 《用户协议》页面：`miniprogram/pages/agreement/agreement`
- 预约提交前勾选同意流程
- 预约页的隐私收集说明文案

你仍需手动完成：

- 在微信公众平台后台配置《用户隐私保护指引》
- 将 `miniprogram/utils/legal.js` 中的联系方式替换为真实信息
- 按实际要求确认保存期限、删除方式、联系方式文案

### 2. 权限安全

已移除原来的默认管理员密码 / 默认绑定码思路，改为：

- 管理员权限：基于 `adminOpenIds` 白名单
- 管理员页：独立页面 `pages/admin/admin`，普通用户页不直接展示
- 服务人员权限：用户提交申请，管理员审批后生效
- 服务人员分组：由管理员分配，不再允许服务人员自行认领

## 管理员白名单配置

首次上线前，请在云数据库 `settings` 集合中的 `global` 文档里配置：

```json
{
  "adminOpenIds": [
    "你的管理员OpenID"
  ]
}
```

如果 `global` 文档还不存在，可先运行一次小程序让云函数自动创建，再在数据库控制台补充 `adminOpenIds`。

## 目录结构

```text
.
├─ cloudfunctions/
│  └─ bookingService/
├─ miniprogram/
│  ├─ pages/
│  ├─ utils/
│  └─ assets/
└─ project.config.json
```

## 使用方式

### 1. 创建云开发环境

在微信开发者工具里创建云开发环境，并记录环境 ID。

### 2. 配置环境 ID

编辑：

`miniprogram/utils/config.js`

填入你自己的云开发环境 ID。

### 3. 上传云函数

在微信开发者工具中：

- 右键 `cloudfunctions/bookingService`
- 选择“上传并部署：云端安装依赖”

### 4. 初始化管理员 OpenID

在云数据库 `settings/global` 中写入管理员白名单 `adminOpenIds`。

### 5. 配置隐私内容

- 微信公众平台后台配置《用户隐私保护指引》
- 修改 `miniprogram/utils/legal.js`

## 云数据库集合

当前使用：

- `settings`
- `appointments`
- `staff_profiles`

## 当前规则说明

- 每个时段最多预约 **10 人**
- 同一用户同一天只允许提交 **1 条有效预约**
- 服务人员必须经管理员审批后才能获得权限
- 服务人员分组只能由管理员分配
- 管理员能力只对 OpenID 白名单开放

## 补充文档

- 管理员 OpenID 初始化说明：`docs/admin-openid-init.md`
- 云数据库集合字段文档：`docs/cloud-db-schema.md`
- 提审前检查清单：`docs/release-checklist.md`
