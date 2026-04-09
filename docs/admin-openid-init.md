# 管理员 OpenID 初始化说明

更新时间：2026-04-08

## 目的

本项目已取消“管理员密码”模式，改为 **OpenID 白名单** 控制管理员权限。

只有 `settings` 集合 `global` 文档中的 `adminOpenIds` 里的 OpenID，才能访问：

- 管理后台页面 `miniprogram/pages/admin/admin`
- 云函数中的管理员接口
  - `getAdminData`
  - `reviewStaffRequest`
  - `updateStaffGroup`
  - `updateSemesterConfig`
  - `updateDateAvailability`

---

## 一、先让系统自动生成 settings/global

如果你还没有初始化过数据库：

1. 在微信开发者工具上传并部署云函数 `cloudfunctions/bookingService`
2. 启动一次小程序
3. 任意进入首页/预约页，云函数会自动创建：
   - 集合：`settings`
   - 文档：`global`

---

## 二、获取管理员 OpenID

推荐做法：

1. 临时在云函数里打印当前用户 OpenID，或使用一个只读调试云函数返回 `cloud.getWXContext().OPENID`
2. 用你的管理员微信登录小程序
3. 记录拿到的 OpenID

> 注意：OpenID 与小程序 AppID 强相关，不同小程序的 OpenID 不同。

---

## 三、写入管理员白名单

在微信云开发控制台 / 开发者工具数据库面板中，打开：

- 集合：`settings`
- 文档：`global`

补充或修改字段：

```json
{
  "adminOpenIds": [
    "管理员openid-1",
    "管理员openid-2"
  ]
}
```

完整示例：

```json
{
  "_id": "global",
  "semesterStartDate": "2026-02-23",
  "dutyStartWeek": 1,
  "bookingWeeksAhead": 4,
  "closedDates": [],
  "adminOpenIds": [
    "oXXXXXXXXXXXXXX1",
    "oXXXXXXXXXXXXXX2"
  ]
}
```

---

## 四、验证是否生效

用管理员微信重新进入小程序后检查：

1. “我的”页能看到“管理员入口”
2. 点击后可进入 `/pages/admin/admin`
3. 可正常查看：
   - 服务人员审批
   - 分组管理
   - 学期轮值配置
   - 预约开关管理

如果不是白名单用户：

- “我的”页不会显示管理员入口
- 即使手动跳页，云函数也会返回“无管理员权限”

---

## 五、上线建议

1. 至少配置 **2 个管理员 OpenID**
2. 不要把 OpenID 白名单写死在前端
3. 不要恢复密码式管理员校验
4. 每次交接管理员时，同步更新 `settings/global.adminOpenIds`

---

## 六、故障排查

### 1. 进入后台提示“无管理员权限”

检查：

- 当前登录微信是否就是白名单微信
- 写入的 OpenID 是否属于当前小程序
- `adminOpenIds` 是否写在 `settings/global` 文档中

### 2. 数据库里没有 global 文档

先触发一次云函数 `getAppData`，系统会自动创建。

### 3. 已写入白名单但前端没显示入口

可先下拉刷新“我的”页，或重新编译后再试。

---

## 七、相关代码位置

- 云函数权限校验：`cloudfunctions/bookingService/index.js`
- 用户页管理员入口：`miniprogram/pages/user/user.js`
- 管理后台页面：`miniprogram/pages/admin/admin.js`
