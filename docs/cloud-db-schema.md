# 云数据库集合字段文档

更新时间：2026-04-08

本项目当前主要使用 3 个集合：

- `settings`
- `appointments`
- `staff_profiles`

---

## 1. settings

### 用途

存放全局配置、轮值配置、管理员白名单、手动关闭日期。

### 文档

固定文档：

- `_id = "global"`

### 字段

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `_id` | string | 是 | 固定为 `global` |
| `semesterStartDate` | string | 是 | 学期开始日期，格式 `YYYY-MM-DD` |
| `dutyStartWeek` | number | 是 | 从第几周开始轮值 |
| `bookingWeeksAhead` | number | 否 | 允许提前展示/预约未来几周，默认 4 |
| `closedDates` | string[] | 否 | 被管理员手动关闭预约的日期列表 |
| `adminOpenIds` | string[] | 是 | 管理员 OpenID 白名单 |
| `updatedAt` | serverDate | 否 | 最后更新时间 |

### 示例

```json
{
  "_id": "global",
  "semesterStartDate": "2026-02-23",
  "dutyStartWeek": 1,
  "bookingWeeksAhead": 4,
  "closedDates": [
    "2026-05-02"
  ],
  "adminOpenIds": [
    "oXXXXXXXXXXXXXX1",
    "oXXXXXXXXXXXXXX2"
  ]
}
```

---

## 2. appointments

### 用途

存放用户预约单。

### 字段

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `_id` | string | 是 | 系统生成 |
| `userOpenId` | string | 是 | 预约用户 OpenID |
| `weekKey` | string | 是 | 当前实现中等于 `serviceDate` |
| `serviceDate` | string | 是 | 预约日期，格式 `YYYY-MM-DD` |
| `serviceDateLabel` | string | 是 | 展示文案，如 `2026年4月11日` |
| `weekNo` | number | 是 | 学期中的第几周 |
| `groupId` | number | 是 | 当天值班组 ID |
| `groupName` | string | 是 | 当天值班组名称 |
| `slotId` | string | 是 | 时段 ID，如 `slot1` |
| `slotLabel` | string | 是 | 时段文案，如 `19:00-20:00` |
| `appointmentType` | string | 是 | 预约类型 |
| `name` | string | 是 | 用户姓名 |
| `phone` | string | 是 | 用户手机号 |
| `request` | string | 是 | 预约需求 |
| `privacyConsent` | boolean | 是 | 是否同意隐私政策 |
| `agreementConsent` | boolean | 是 | 是否同意用户协议 |
| `status` | string | 是 | `booked` / `completed` / `cancelled` |
| `createdAt` | serverDate | 是 | 创建时间 |
| `closedAt` | serverDate | 否 | 结单时间 |
| `closedBy` | string | 否 | 结单服务人员姓名 |
| `cancelledAt` | serverDate | 否 | 取消时间 |

### 示例

```json
{
  "_id": "xxxx",
  "userOpenId": "oXXXXXXXXXXXXXXU",
  "weekKey": "2026-04-11",
  "serviceDate": "2026-04-11",
  "serviceDateLabel": "2026年4月11日",
  "weekNo": 7,
  "groupId": 3,
  "groupName": "第三组",
  "slotId": "slot1",
  "slotLabel": "19:00-20:00",
  "appointmentType": "系统异常",
  "name": "张三",
  "phone": "13800138000",
  "request": "笔记本蓝屏，需要排查系统问题",
  "privacyConsent": true,
  "agreementConsent": true,
  "status": "booked"
}
```

### 建议索引

建议为以下组合建立索引：

1. `serviceDate + slotId + status`
2. `userOpenId + serviceDate + status`
3. `serviceDate + status`

---

## 3. staff_profiles

### 用途

存放服务人员申请、审批和分组信息。

### 状态说明

| 状态 | 含义 |
|---|---|
| `pending` | 已提交申请，待管理员审批 |
| `approved` | 已通过审批，拥有服务人员权限 |
| `rejected` | 已被驳回 |

### 字段

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `_id` | string | 是 | 直接使用用户 OpenID 作为主键 |
| `staffName` | string | 是 | 申请人姓名 |
| `status` | string | 是 | `pending` / `approved` / `rejected` |
| `isStaff` | boolean | 是 | 兼容字段，审批通过时为 `true` |
| `groupId` | number | 是 | 管理员分配的组别，未分配时为 0 |
| `rejectReason` | string | 否 | 驳回原因，当前后台未填写时通常为空 |
| `appliedAt` | serverDate | 否 | 首次申请时间 |
| `approvedAt` | serverDate | 否 | 审批通过时间 |
| `reviewedAt` | serverDate | 否 | 审批时间 |
| `reviewedBy` | string | 否 | 审批管理员 OpenID |
| `updatedAt` | serverDate | 否 | 最后更新时间 |

### 示例

```json
{
  "_id": "oXXXXXXXXXXXXXXS",
  "staffName": "李四",
  "status": "approved",
  "isStaff": true,
  "groupId": 2,
  "rejectReason": "",
  "appliedAt": "serverDate",
  "approvedAt": "serverDate",
  "reviewedAt": "serverDate",
  "reviewedBy": "oXXXXXXXXXXXXXXA",
  "updatedAt": "serverDate"
}
```

### 建议索引

建议建立：

1. `status + updatedAt`

---

## 4. 数据关系说明

- `appointments.userOpenId` → 普通预约用户
- `staff_profiles._id` → 服务人员用户 OpenID
- `settings.adminOpenIds[]` → 管理员用户 OpenID

三者都是围绕同一个小程序下的 OpenID 体系运作。

---

## 5. 敏感字段说明

以下字段涉及个人信息，建议重点控制读写权限：

- `appointments.name`
- `appointments.phone`
- `appointments.request`
- `appointments.userOpenId`
- `staff_profiles._id`
- `settings.adminOpenIds`

---

## 6. 上线建议

1. 为数据库集合补充访问权限规则
2. 仅允许云函数写入敏感集合
3. 不允许前端直接修改：
   - `settings`
   - `appointments.status`
   - `staff_profiles.status`
4. 定期清理过期预约数据，和隐私政策中的保存期限保持一致
