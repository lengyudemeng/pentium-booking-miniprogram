const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const SETTINGS_COLLECTION = 'settings';
const APPOINTMENTS_COLLECTION = 'appointments';
const STAFF_PROFILE_COLLECTION = 'staff_profiles';
const DUTY_SIGNINS_COLLECTION = 'duty_signins';
const SETTINGS_DOC_ID = 'global';
const DEFAULT_DUTY_START_WEEK = 1;
const DEFAULT_BOOKING_WEEKS_AHEAD = 4;
const SEMESTER_DUTY_PREVIEW_WEEKS = 20;
const MAX_APPOINTMENTS_PER_SLOT = 10;
const GROUP_OPTIONS = [
  { id: 1, name: '第一组' },
  { id: 2, name: '第二组' },
  { id: 3, name: '第三组' },
  { id: 4, name: '第四组' }
];
const SLOT_TEMPLATES = [
  { id: 'slot1', label: '19:00-20:00', startHour: 19, endHour: 20 },
  { id: 'slot2', label: '20:00-21:00', startHour: 20, endHour: 21 }
];
const SLOT_ORDER = { slot1: 1, slot2: 2 };
const TOTAL_CAPACITY_PER_DATE = SLOT_TEMPLATES.length * MAX_APPOINTMENTS_PER_SLOT;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CHINA_OFFSET_HOURS = 8;
const BOOKING_NAME_MAX_LENGTH = 20;
const BOOKING_REQUEST_MAX_LENGTH = 300;
const BOOKING_MODERATION_KEYWORDS = [
  '奶龙',
  '危害国家安全',
  '颠覆国家',
  '颠覆政权',
  '分裂国家',
  '煽动分裂',
  '煽动暴力',
  '暴力恐怖',
  '恐怖袭击',
  '恐怖主义',
  '极端主义',
  '邪教组织',
  '泄露国家秘密',
  '间谍活动',
  '贩卖毒品',
  '贩毒',
  '制毒',
  '冰毒',
  '海洛因',
  '摇头丸',
  '大麻交易',
  '买卖枪支',
  '非法枪支',
  '枪支弹药',
  '制作炸弹',
  '炸弹教程',
  '爆炸物制作',
  '杀人教程',
  '绑架勒索',
  '人口贩卖',
  '洗钱',
  '诈骗教程',
  '网络赌博',
  '赌博网站',
  '私彩',
  '招嫖',
  '裸聊',
  '约炮',
  '成人视频',
  '色情网',
  '黄色网站',
  '偷拍视频',
  '傻逼',
  '煞笔',
  '脑残',
  '废物东西',
  '去死吧',
  '去死',
  '滚蛋',
  '你妈死了',
  '操你妈',
  '草你妈',
  '艹你妈',
  '妈卖批',
  'nmsl',
  'cnm',
  '地域黑',
  '挑起对立',
  '煽动仇恨',
  '人身攻击',
  '恶意辱骂'
];
const BOOKING_MODERATION_PATTERNS = [
  /(?:制作|生成|植入|传播|投放|免杀|远控|贩卖).{0,10}(?:木马|病毒|勒索软件|恶意软件)/i,
  /(?:木马|病毒|勒索软件|恶意软件).{0,10}(?:制作|生成|植入|传播|投放|免杀|远控|源码)/i,
  /(?:攻击|入侵|黑掉|渗透|盗取|撞库|脱库).{0,10}(?:网站|服务器|账号|数据库|校园网|内网|系统)/i,
  /(?:帮我|教我|我要|想要|提供).{0,10}(?:攻击|入侵|盗号|钓鱼|破解|绕过|免杀|炸号|刷量)/i,
  /(?:ddos|dos攻击|sql注入|xss|getshell|webshell|反弹shell|提权|漏洞利用|暴力破解|撞库|脱库|钓鱼网站|盗号|抓包盗取|远控木马|免杀木马|勒索病毒|肉鸡|僵尸网络)/i
];
const DISALLOWED_CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MODERATION_SEPARATOR_PATTERN = /[\s\u200B-\u200D\uFEFF\-_=+.,，。！？!?、\\/|'"“”‘’`~@#$%^&*:;；：<>()（）\[\]【】{}《》]/g;

function getChinaNow() {
  return new Date();
}

function getChinaParts(date = new Date()) {
  const shifted = new Date(date.getTime() + CHINA_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay()
  };
}

function makeChinaDate(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - CHINA_OFFSET_HOURS, minute, second));
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function parseDateString(dateStr) {
  const normalized = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('日期格式不正确');
  }

  const [year, month, day] = normalized.split('-').map((item) => Number(item));
  const date = makeChinaDate(year, month, day, 0, 0, 0);
  const parts = getChinaParts(date);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    throw new Error('日期格式不正确');
  }
  return date;
}

function formatDate(date) {
  const parts = getChinaParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatDateLabel(date) {
  const parts = getChinaParts(date);
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function formatDateTimeLabel(date) {
  const parts = getChinaParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeBookingText(value) {
  const text = String(value || '');
  const normalized = typeof text.normalize === 'function' ? text.normalize('NFKC') : text;
  return normalized
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countTextLength(value) {
  return Array.from(String(value || '')).length;
}

function normalizeForModeration(value) {
  return normalizeBookingText(value)
    .toLowerCase()
    .replace(MODERATION_SEPARATOR_PATTERN, '');
}

function hasBlockedBookingContent(value) {
  const text = normalizeForModeration(value);
  return BOOKING_MODERATION_KEYWORDS.some((keyword) => text.includes(normalizeForModeration(keyword)))
    || BOOKING_MODERATION_PATTERNS.some((pattern) => pattern.test(text));
}

function getBookingContentError({ name = '', request = '' } = {}) {
  const normalizedName = normalizeBookingText(name);
  const normalizedRequest = normalizeBookingText(request);
  if (DISALLOWED_CONTROL_CHAR_PATTERN.test(String(name || '')) || DISALLOWED_CONTROL_CHAR_PATTERN.test(String(request || ''))) {
    return '请删除不可见特殊字符后再提交';
  }
  if (countTextLength(normalizedName) > BOOKING_NAME_MAX_LENGTH) {
    return `姓名最多 ${BOOKING_NAME_MAX_LENGTH} 个字`;
  }
  if (countTextLength(normalizedRequest) > BOOKING_REQUEST_MAX_LENGTH) {
    return `预约需求最多 ${BOOKING_REQUEST_MAX_LENGTH} 个字`;
  }
  if (hasBlockedBookingContent(normalizedName) || hasBlockedBookingContent(normalizedRequest)) {
    return '姓名或预约需求包含不适宜提交的内容';
  }
  return '';
}

function isMsgSecCheckBlocked(result = {}) {
  return result.errCode === 87014
    || result.errcode === 87014
    || (result.result && result.result.suggest && result.result.suggest !== 'pass')
    || (result.result && result.result.label && result.result.label !== 100);
}

async function assertMessageContentSafe(openid, content) {
  if (!content) {
    return;
  }
  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.msgSecCheck) {
    throw new Error('内容安全检测暂时不可用，请稍后再试');
  }

  try {
    const result = await cloud.openapi.security.msgSecCheck({
      openid,
      scene: 2,
      version: 2,
      content
    });
    if (isMsgSecCheckBlocked(result)) {
      throw new Error('内容安全检测未通过，请修改后再提交');
    }
  } catch (error) {
    if (error && (error.errCode === 87014 || error.errcode === 87014 || error.message === '内容安全检测未通过，请修改后再提交')) {
      throw new Error('内容安全检测未通过，请修改后再提交');
    }
    console.warn('msgSecCheck skipped:', error && (error.errMsg || error.message || error));
    throw new Error('内容安全检测暂时不可用，请稍后再试');
  }
}

function getChinaDateStart(date) {
  const parts = getChinaParts(date);
  return makeChinaDate(parts.year, parts.month, parts.day, 0, 0, 0);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function getCurrentWeekMonday(now = getChinaNow()) {
  const currentDateStart = getChinaDateStart(now);
  const weekday = getChinaParts(now).weekday;
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(currentDateStart, offset);
}

function getCurrentOrNextSaturday(now = getChinaNow()) {
  const currentDateStart = getChinaDateStart(now);
  const currentParts = getChinaParts(now);
  const offset = (6 - currentParts.weekday + 7) % 7;
  let saturday = addDays(currentDateStart, offset);
  const saturdayParts = getChinaParts(saturday);
  const saturdayServiceEnd = makeChinaDate(saturdayParts.year, saturdayParts.month, saturdayParts.day, 21, 0, 0);
  if (offset === 0 && now >= saturdayServiceEnd) {
    saturday = addDays(saturday, 7);
  }
  return saturday;
}

function getFirstSaturdayOnOrAfter(date) {
  const currentDateStart = getChinaDateStart(date);
  const weekday = getChinaParts(currentDateStart).weekday;
  const offset = (6 - weekday + 7) % 7;
  return addDays(currentDateStart, offset);
}

function getSlotDefinitions(serviceDate) {
  const serviceParts = getChinaParts(serviceDate);
  return SLOT_TEMPLATES.map((slot) => ({
    id: slot.id,
    label: slot.label,
    start: makeChinaDate(serviceParts.year, serviceParts.month, serviceParts.day, slot.startHour, 0, 0),
    end: makeChinaDate(serviceParts.year, serviceParts.month, serviceParts.day, slot.endHour, 0, 0)
  }));
}

function getServiceDateStart(serviceDate) {
  const slots = getSlotDefinitions(serviceDate);
  return slots.length ? slots[0].start : getChinaDateStart(serviceDate);
}

function getServiceDateEnd(serviceDate) {
  const slots = getSlotDefinitions(serviceDate);
  return slots.length ? slots[slots.length - 1].end : addDays(getChinaDateStart(serviceDate), 1);
}

function isServiceDateNotStarted(serviceDate, now = getChinaNow()) {
  return now < getServiceDateStart(serviceDate);
}

function isDutyCheckInOpen(serviceDate, now = getChinaNow()) {
  const serviceDateObj = typeof serviceDate === 'string' ? parseDateString(serviceDate) : serviceDate;
  return now >= getChinaDateStart(serviceDateObj) && now <= getServiceDateEnd(serviceDateObj);
}

function isCurrentWeekServiceDate(serviceDate, now = getChinaNow()) {
  const serviceDateObj = typeof serviceDate === 'string' ? parseDateString(serviceDate) : serviceDate;
  const currentWeekMonday = getCurrentWeekMonday(now);
  const nextWeekMonday = addDays(currentWeekMonday, 7);
  const serviceDateStart = getChinaDateStart(serviceDateObj).getTime();
  return serviceDateStart >= currentWeekMonday.getTime() && serviceDateStart < nextWeekMonday.getTime();
}

function canGenerateDutyCheckInQrCode(serviceDate, now = getChinaNow()) {
  const serviceDateObj = typeof serviceDate === 'string' ? parseDateString(serviceDate) : serviceDate;
  return isCurrentWeekServiceDate(serviceDateObj, now) && now <= getServiceDateEnd(serviceDateObj);
}

function maskPhone(phone = '') {
  if (String(phone).length !== 11) {
    return phone;
  }
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function getGroupName(groupId) {
  const group = GROUP_OPTIONS.find((item) => item.id === Number(groupId));
  return group ? group.name : '';
}

function normalizeClosedDates(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => formatDate(parseDateString(item))))).sort();
}

function normalizeAdminOpenIds(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

function getSettingsRuntimeCache(settings) {
  if (!settings.__runtimeCache) {
    Object.defineProperty(settings, '__runtimeCache', {
      value: {
        weekNoByDate: new Map(),
        closedDutyCountByDate: new Map(),
        scheduleInfoByDate: new Map(),
        closedDutyTimeline: null
      },
      enumerable: false,
      configurable: true
    });
  }
  return settings.__runtimeCache;
}

function normalizeSettings(data = {}) {
  return {
    semesterStartDate: data.semesterStartDate || formatDate(getCurrentWeekMonday()),
    dutyStartWeek: Number(data.dutyStartWeek) > 0 ? Number(data.dutyStartWeek) : DEFAULT_DUTY_START_WEEK,
    bookingWeeksAhead: Number(data.bookingWeeksAhead) > 0 ? Number(data.bookingWeeksAhead) : DEFAULT_BOOKING_WEEKS_AHEAD,
    closedDates: normalizeClosedDates(data.closedDates),
    adminOpenIds: normalizeAdminOpenIds(data.adminOpenIds),
    staffBindingCode: String(data.staffBindingCode || '').trim()
  };
}

function isAdminOpenId(openid, settings) {
  return Boolean(openid) && (settings.adminOpenIds || []).includes(openid);
}

function assertAdmin(openid, settings) {
  if (!isAdminOpenId(openid, settings)) {
    throw new Error('无管理员权限');
  }
}

function isDateManuallyClosed(settings, serviceDate) {
  return (settings.closedDates || []).includes(serviceDate);
}

function getWeekNoByServiceDate(serviceDate, settings) {
  const serviceDateObj = typeof serviceDate === 'string' ? parseDateString(serviceDate) : serviceDate;
  const serviceDateKey = formatDate(serviceDateObj);
  const cache = getSettingsRuntimeCache(settings);
  if (cache.weekNoByDate.has(serviceDateKey)) {
    return cache.weekNoByDate.get(serviceDateKey);
  }
  const semesterStart = parseDateString(settings.semesterStartDate);
  const diffDays = Math.floor((getChinaDateStart(serviceDateObj).getTime() - getChinaDateStart(semesterStart).getTime()) / ONE_DAY_MS);
  const weekNo = Math.floor(diffDays / 7) + 1;
  cache.weekNoByDate.set(serviceDateKey, weekNo);
  return weekNo;
}

function getClosedDutyTimeline(settings) {
  const cache = getSettingsRuntimeCache(settings);
  if (cache.closedDutyTimeline) {
    return cache.closedDutyTimeline;
  }

  cache.closedDutyTimeline = normalizeClosedDates(settings.closedDates)
    .map((item) => {
      try {
        const dateObj = parseDateString(item);
        return {
          serviceDate: item,
          timestamp: getChinaDateStart(dateObj).getTime(),
          weekNo: getWeekNoByServiceDate(dateObj, settings)
        };
      } catch (error) {
        return null;
      }
    })
    .filter((item) => item && item.weekNo >= settings.dutyStartWeek)
    .sort((a, b) => a.timestamp - b.timestamp);

  return cache.closedDutyTimeline;
}

function getClosedDutyCountBeforeServiceDate(serviceDateObj, settings) {
  const serviceDateKey = formatDate(serviceDateObj);
  const cache = getSettingsRuntimeCache(settings);
  if (cache.closedDutyCountByDate.has(serviceDateKey)) {
    return cache.closedDutyCountByDate.get(serviceDateKey);
  }

  const currentServiceDate = getChinaDateStart(serviceDateObj).getTime();
  const closedDutyTimeline = getClosedDutyTimeline(settings);
  let count = 0;
  for (let index = 0; index < closedDutyTimeline.length; index += 1) {
    if (closedDutyTimeline[index].timestamp >= currentServiceDate) {
      break;
    }
    count += 1;
  }
  cache.closedDutyCountByDate.set(serviceDateKey, count);
  return count;
}

function getScheduleInfoByServiceDate(serviceDate, settings) {
  const serviceDateObj = typeof serviceDate === 'string' ? parseDateString(serviceDate) : serviceDate;
  const serviceDateKey = formatDate(serviceDateObj);
  const cache = getSettingsRuntimeCache(settings);
  if (cache.scheduleInfoByDate.has(serviceDateKey)) {
    return cache.scheduleInfoByDate.get(serviceDateKey);
  }
  const weekNo = getWeekNoByServiceDate(serviceDateObj, settings);
  const dutyStarted = weekNo >= settings.dutyStartWeek;
  const closedDutyCountBefore = dutyStarted ? getClosedDutyCountBeforeServiceDate(serviceDateObj, settings) : 0;
  const groupSequenceIndex = weekNo - settings.dutyStartWeek - closedDutyCountBefore;
  const groupId = dutyStarted ? ((groupSequenceIndex % 4) + 4) % 4 + 1 : 0;
  const groupName = getGroupName(groupId);
  const isManuallyClosed = isDateManuallyClosed(settings, serviceDateKey);
  const isDutyOpen = dutyStarted && !isManuallyClosed;
  const description = !dutyStarted
    ? `第${weekNo}周 · 暂未开始值班`
    : isManuallyClosed
      ? `第${weekNo}周 · ${groupName}值班（已关闭预约）`
      : `第${weekNo}周 · ${groupName}值班`;

  const scheduleInfo = {
    serviceDate: serviceDateKey,
    serviceDateLabel: formatDateLabel(serviceDateObj),
    weekNo,
    groupId,
    groupName,
    dutyStarted,
    isDutyOpen,
    isManuallyClosed,
    description,
    serviceDateObj
  };
  cache.scheduleInfoByDate.set(serviceDateKey, scheduleInfo);
  return scheduleInfo;
}
function buildUpcomingDateOptions(settings, now = getChinaNow()) {
  const startSaturday = getCurrentOrNextSaturday(now);
  const count = settings.bookingWeeksAhead || DEFAULT_BOOKING_WEEKS_AHEAD;
  return Array.from({ length: count }).map((_, index) => getScheduleInfoByServiceDate(addDays(startSaturday, index * 7), settings));
}

function buildSemesterDutyPreview(settings, weeks = SEMESTER_DUTY_PREVIEW_WEEKS) {
  const semesterStart = parseDateString(settings.semesterStartDate);
  const firstSaturday = getFirstSaturdayOnOrAfter(semesterStart);
  return Array.from({ length: weeks }).map((_, index) => {
    const scheduleInfo = getScheduleInfoByServiceDate(addDays(firstSaturday, index * 7), settings);
    return {
      ...scheduleInfo,
      weekLabel: `第${scheduleInfo.weekNo}周`,
      dutyText: scheduleInfo.dutyStarted ? `${scheduleInfo.groupName}值班` : '暂未开始值班'
    };
  });
}

function buildAdminManageDateOptions(settings, now = getChinaNow(), weeks = SEMESTER_DUTY_PREVIEW_WEEKS) {
  return buildSemesterDutyPreview(settings, weeks).filter((item) => item.dutyStarted && isServiceDateNotStarted(item.serviceDateObj, now));
}

function buildDutyCheckInDateOptions(settings, weeks = SEMESTER_DUTY_PREVIEW_WEEKS) {
  return buildSemesterDutyPreview(settings, weeks).filter((item) => item.dutyStarted);
}

function getAppointmentGroupInfo(item, settings) {
  const scheduleInfo = getScheduleInfoByServiceDate(item.serviceDate, settings);
  return {
    groupId: scheduleInfo.groupId,
    groupName: scheduleInfo.groupName,
    weekNo: scheduleInfo.weekNo,
    serviceDateLabel: scheduleInfo.serviceDateLabel
  };
}

function normalizeStaffStatus(profile) {
  if (!profile) {
    return 'none';
  }
  if (profile.status) {
    return profile.status;
  }
  return profile.isStaff ? 'approved' : 'none';
}

function normalizeStaffProfile(profile) {
  const status = normalizeStaffStatus(profile);
  const groupId = status === 'approved' ? Number(profile && profile.groupId) || 0 : 0;
  return {
    openId: profile ? profile._id : '',
    staffName: profile && profile.staffName ? profile.staffName : '',
    status,
    isStaff: status === 'approved',
    isPending: status === 'pending',
    isRejected: status === 'rejected',
    groupId,
    groupName: getGroupName(groupId),
    reviewedAt: profile && profile.reviewedAt ? profile.reviewedAt : null,
    rejectReason: profile && profile.rejectReason ? profile.rejectReason : ''
  };
}

function decorateAppointment(item, settings, now = getChinaNow()) {
  const scheduleInfo = getScheduleInfoByServiceDate(item.serviceDate, settings);
  const appointmentGroupInfo = getAppointmentGroupInfo(item, settings);
  const serviceDateStart = getChinaDateStart(parseDateString(item.serviceDate));
  let statusText = '待服务';
  if (item.status === 'completed') {
    statusText = '已结单';
  } else if (item.status === 'cancelled') {
    statusText = '已取消';
  }

  return {
    id: item._id,
    weekKey: item.weekKey || item.serviceDate,
    serviceDate: item.serviceDate,
    serviceDateLabel: item.serviceDateLabel || scheduleInfo.serviceDateLabel,
    slotId: item.slotId,
    slotLabel: item.slotLabel,
    appointmentType: item.appointmentType || '',
    name: item.name,
    phone: item.phone,
    phoneMasked: maskPhone(item.phone),
    request: item.request,
    status: item.status,
    statusText,
    groupId: appointmentGroupInfo.groupId,
    groupName: appointmentGroupInfo.groupName,
    weekNo: appointmentGroupInfo.weekNo,
    createdAt: item.createdAt || null,
    closedAt: item.closedAt || null,
    closedBy: item.closedBy || '',
    cancelledAt: item.cancelledAt || null,
    canCancel: item.status === 'booked' && now < serviceDateStart
  };
}

function buildSlotStatus(serviceDate, scheduleInfo, appointments, settings, now = getChinaNow()) {
  const slots = getSlotDefinitions(serviceDate);
  const dateClosed = isDateManuallyClosed(settings, scheduleInfo.serviceDate);

  if (!scheduleInfo.dutyStarted) {
    return slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      status: 'closed',
      statusText: '未开放',
      detailText: '该周六未安排值班',
      bookedCount: 0,
      completedCount: 0,
      reservedCount: 0,
      remainingCount: 0,
      capacity: MAX_APPOINTMENTS_PER_SLOT
    }));
  }

  if (dateClosed) {
    return slots.map((slot) => {
      const currentAppointments = appointments.filter((item) => item.slotId === slot.id && item.status !== 'cancelled');
      const bookedCount = currentAppointments.filter((item) => item.status === 'booked').length;
      const completedCount = currentAppointments.filter((item) => item.status === 'completed').length;
      const reservedCount = bookedCount + completedCount;
      return {
        id: slot.id,
        label: slot.label,
        status: 'closed',
        statusText: '已关闭',
        detailText: reservedCount > 0 ? `当日预约已关闭，当前已预约 ${reservedCount}/${MAX_APPOINTMENTS_PER_SLOT}` : '该日预约已由管理员关闭',
        bookedCount,
        completedCount,
        reservedCount,
        remainingCount: 0,
        capacity: MAX_APPOINTMENTS_PER_SLOT,
        isManuallyClosed: true,
        manageKey: scheduleInfo.serviceDate
      };
    });
  }

  return slots.map((slot) => {
    const currentAppointments = appointments.filter((item) => item.slotId === slot.id && item.status !== 'cancelled');
    const bookedCount = currentAppointments.filter((item) => item.status === 'booked').length;
    const completedCount = currentAppointments.filter((item) => item.status === 'completed').length;
    const reservedCount = bookedCount + completedCount;
    const remainingCount = Math.max(MAX_APPOINTMENTS_PER_SLOT - reservedCount, 0);
    const basePayload = {
      id: slot.id,
      label: slot.label,
      bookedCount,
      completedCount,
      reservedCount,
      remainingCount,
      capacity: MAX_APPOINTMENTS_PER_SLOT,
      isManuallyClosed: false,
      manageKey: scheduleInfo.serviceDate
    };

    if (now >= slot.start) {
      if (reservedCount > 0) {
        return {
          ...basePayload,
          status: bookedCount > 0 ? 'closed' : 'completed',
          statusText: bookedCount > 0 ? '已截止' : '已完成',
          detailText: bookedCount > 0 ? `已预约 ${reservedCount}/${MAX_APPOINTMENTS_PER_SLOT}，当前不可再预约` : `已完成 ${completedCount}/${MAX_APPOINTMENTS_PER_SLOT}`
        };
      }
      return { ...basePayload, status: 'closed', statusText: '已截止', detailText: '当前时段已停止预约' };
    }

    if (remainingCount <= 0) {
      return { ...basePayload, status: 'full', statusText: '已约满', detailText: `已预约 ${reservedCount}/${MAX_APPOINTMENTS_PER_SLOT}` };
    }

    return {
      ...basePayload,
      status: 'available',
      statusText: `剩余 ${remainingCount} 位`,
      detailText: reservedCount > 0 ? `已预约 ${reservedCount}/${MAX_APPOINTMENTS_PER_SLOT}` : `本时段最多可预约 ${MAX_APPOINTMENTS_PER_SLOT} 人`
    };
  });
}

function buildScheduleOverview(dateOptions, appointments, settings, now = getChinaNow()) {
  return dateOptions.map((option) => {
    const currentAppointments = appointments.filter((item) => item.serviceDate === option.serviceDate && item.status !== 'cancelled');
    const slots = buildSlotStatus(parseDateString(option.serviceDate), option, currentAppointments, settings, now);
    const bookedCount = currentAppointments.filter((item) => item.status === 'booked').length;
    const completedCount = currentAppointments.filter((item) => item.status === 'completed').length;
    const availableCount = slots.reduce((sum, item) => sum + (item.status === 'available' ? item.remainingCount : 0), 0);
    const summaryText = !option.dutyStarted ? '未开始' : option.isManuallyClosed ? '已关闭' : `剩余 ${availableCount}/${TOTAL_CAPACITY_PER_DATE}`;
    return { ...option, bookedCount, completedCount, availableCount, summaryText, slots, manageKey: option.serviceDate };
  });
}

function pickSelectedDate(requestedDate, dateOptions) {
  if (!dateOptions.length) {
    return null;
  }
  return dateOptions.find((item) => item.serviceDate === requestedDate)
    || dateOptions.find((item) => item.isDutyOpen)
    || dateOptions[0];
}

function sortAppointmentsBySlot(a, b) {
  return (SLOT_ORDER[a.slotId] || 99) - (SLOT_ORDER[b.slotId] || 99);
}

function pickAdminBookingQueryDate(requestedDate, dutyDateOptions, now = getChinaNow()) {
  if (!dutyDateOptions.length) {
    return null;
  }
  return dutyDateOptions.find((item) => item.serviceDate === requestedDate)
    || dutyDateOptions.find((item) => !isServiceDateNotStarted(item.serviceDateObj, now) && now <= getServiceDateEnd(item.serviceDateObj))
    || dutyDateOptions.find((item) => isServiceDateNotStarted(item.serviceDateObj, now))
    || dutyDateOptions[dutyDateOptions.length - 1];
}

function sortAdminQueryAppointments(a, b) {
  const slotOrderDiff = sortAppointmentsBySlot(a, b);
  if (slotOrderDiff !== 0) {
    return slotOrderDiff;
  }
  if (a.status !== b.status) {
    if (a.status === 'booked') {
      return -1;
    }
    if (b.status === 'booked') {
      return 1;
    }
  }
  const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return createdAtA - createdAtB;
}

async function ensureSettings() {
  const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
  try {
    const result = await docRef.get();
    return normalizeSettings(result.data);
  } catch (error) {
    const defaultSettings = normalizeSettings();
    await docRef.set({ data: { ...defaultSettings, updatedAt: db.serverDate() } });
    return defaultSettings;
  }
}

async function getStaffProfile(openid) {
  try {
    const result = await db.collection(STAFF_PROFILE_COLLECTION).doc(openid).get();
    return result.data;
  } catch (error) {
    return null;
  }
}

async function getDutySignInByServiceDate(serviceDate) {
  try {
    const result = await db.collection(DUTY_SIGNINS_COLLECTION).doc(serviceDate).get();
    return result.data;
  } catch (error) {
    return null;
  }
}

async function getDutySignInByServiceDates(serviceDates) {
  if (!serviceDates.length) {
    return [];
  }
  try {
    const result = await db.collection(DUTY_SIGNINS_COLLECTION).where({ serviceDate: _.in(serviceDates) }).get();
    return result.data || [];
  } catch (error) {
    return [];
  }
}

async function getAppointmentsByServiceDates(serviceDates) {
  if (!serviceDates.length) {
    return [];
  }
  const result = await db.collection(APPOINTMENTS_COLLECTION).where({ serviceDate: _.in(serviceDates) }).get();
  return result.data || [];
}

async function getMyAppointments(openid, settings, now = getChinaNow()) {
  const result = await db.collection(APPOINTMENTS_COLLECTION).where({ userOpenId: openid }).orderBy('createdAt', 'desc').limit(50).get();
  return (result.data || []).map((item) => decorateAppointment(item, settings, now));
}

async function getSemesterSummary(settings) {
  const semesterStartDate = settings.semesterStartDate;
  const bookedCountResult = await db.collection(APPOINTMENTS_COLLECTION).where({ serviceDate: _.gte(semesterStartDate), status: 'booked' }).count();
  const completedCountResult = await db.collection(APPOINTMENTS_COLLECTION).where({ serviceDate: _.gte(semesterStartDate), status: 'completed' }).count();
  const rawBookedCount = bookedCountResult.total || 0;
  const completedCount = completedCountResult.total || 0;
  const bookedCount = rawBookedCount + completedCount;
  return { bookedCount, completedCount, totalCount: bookedCount };
}

function pickDutyCheckInDate(requestedDate, dutyDateOptions, now = getChinaNow()) {
  if (!dutyDateOptions.length) {
    return null;
  }
  return dutyDateOptions.find((item) => item.serviceDate === requestedDate)
    || dutyDateOptions.find((item) => !isServiceDateNotStarted(item.serviceDateObj, now) && now <= getServiceDateEnd(item.serviceDateObj))
    || dutyDateOptions.find((item) => isServiceDateNotStarted(item.serviceDateObj, now))
    || dutyDateOptions[0];
}

function buildDutyCheckInSummaryByDate(dutyDateOptions, approvedStaffMembers, signInRecords = []) {
  const signInRecordMap = new Map((signInRecords || []).map((item) => [item.serviceDate, item]));
  return dutyDateOptions.map((item) => {
    const groupMembers = approvedStaffMembers.filter((profile) => Number(profile.groupId) === item.groupId);
    const signInRecord = signInRecordMap.get(item.serviceDate) || {};
    const signedOpenIds = new Set((signInRecord.records || []).map((record) => record.openId));
    const signedCount = groupMembers.filter((profile) => signedOpenIds.has(profile.openId)).length;
    const unsignedCount = Math.max(groupMembers.length - signedCount, 0);
    return {
      ...item,
      signedCount,
      unsignedCount,
      totalCount: groupMembers.length,
      signStatusText: `${signedCount}/${groupMembers.length} 已签到`
    };
  });
}

function buildDutyCheckInMemberLists(selectedDutyDate, approvedStaffMembers, signInRecord = null) {
  if (!selectedDutyDate) {
    return {
      signedMembers: [],
      unsignedMembers: []
    };
  }

  const groupMembers = approvedStaffMembers
    .filter((profile) => Number(profile.groupId) === selectedDutyDate.groupId)
    .sort((a, b) => String(a.staffName || '').localeCompare(String(b.staffName || ''), 'zh-Hans-CN'));
  const signInMap = new Map((signInRecord && Array.isArray(signInRecord.records) ? signInRecord.records : []).map((item) => [item.openId, item]));

  const signedMembers = groupMembers
    .filter((profile) => signInMap.has(profile.openId))
    .map((profile) => {
      const record = signInMap.get(profile.openId);
      return {
        openId: profile.openId,
        staffName: profile.staffName,
        groupId: profile.groupId,
        groupName: profile.groupName,
        signedAtLabel: record && record.signedAtLabel ? record.signedAtLabel : ''
      };
    });

  const unsignedMembers = groupMembers
    .filter((profile) => !signInMap.has(profile.openId))
    .map((profile) => ({
      openId: profile.openId,
      staffName: profile.staffName,
      groupId: profile.groupId,
      groupName: profile.groupName
    }));

  return { signedMembers, unsignedMembers };
}

async function getApprovedStaffMembers() {
  const profileResult = await db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
  return (profileResult.data || [])
    .filter((item) => normalizeStaffStatus(item) === 'approved')
    .map((item) => normalizeStaffProfile(item));
}

function buildDutyCheckInExportBuffer(selectedDutyDate, signedMembers = [], unsignedMembers = []) {
  const rows = []
    .concat((signedMembers || []).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.staffName)}</td>
        <td>${escapeHtml(item.groupName || selectedDutyDate.groupName)}</td>
        <td>已签到</td>
        <td>${escapeHtml(item.signedAtLabel || '')}</td>
      </tr>
    `))
    .concat((unsignedMembers || []).map((item, index) => `
      <tr>
        <td>${signedMembers.length + index + 1}</td>
        <td>${escapeHtml(item.staffName)}</td>
        <td>${escapeHtml(item.groupName || selectedDutyDate.groupName)}</td>
        <td>未签到</td>
        <td></td>
      </tr>
    `))
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <table>
          <tr><th colspan="5">值班签到表</th></tr>
          <tr><td>值班日期</td><td colspan="4">${escapeHtml(selectedDutyDate.serviceDateLabel)}</td></tr>
          <tr><td>周次</td><td colspan="4">第${selectedDutyDate.weekNo}周</td></tr>
          <tr><td>值班组别</td><td colspan="4">${escapeHtml(selectedDutyDate.groupName)}</td></tr>
          <tr><th>序号</th><th>姓名</th><th>组别</th><th>签到状态</th><th>签到时间</th></tr>
          ${rows}
        </table>
      </body>
    </html>
  `;

  return Buffer.from(html, 'utf8');
}

async function createDutyCheckInQrCode(serviceDate) {
  const codeResult = await cloud.openapi.wxacode.createQRCode({
    path: `pages/checkin/checkin?serviceDate=${serviceDate}`
  });
  const uploadResult = await cloud.uploadFile({
    cloudPath: `duty-checkin-qrcodes/${serviceDate}-${Date.now()}.png`,
    fileContent: codeResult.buffer
  });
  return uploadResult.fileID;
}

async function ensureDutyCheckInQrCode(serviceDate, scheduleInfo, signInRecord = null) {
  if (signInRecord && signInRecord.qrCodeFileID) {
    return signInRecord.qrCodeFileID;
  }

  const qrCodeFileID = await createDutyCheckInQrCode(serviceDate);
  const docRef = db.collection(DUTY_SIGNINS_COLLECTION).doc(serviceDate);

  if (signInRecord) {
    await docRef.update({
      data: {
        qrCodeFileID,
        updatedAt: db.serverDate()
      }
    });
  } else {
    await docRef.set({
      data: {
        serviceDate,
        weekNo: scheduleInfo.weekNo,
        groupId: scheduleInfo.groupId,
        groupName: scheduleInfo.groupName,
        records: [],
        qrCodeFileID,
        updatedAt: db.serverDate()
      }
    });
  }

  return qrCodeFileID;
}

function validateBookingInput(payload = {}) {
  const { serviceDate, slotId, appointmentType, name, phone, request, privacyConsent, agreementConsent } = payload;
  if (!serviceDate) throw new Error('请选择预约日期');
  if (!slotId) throw new Error('请选择预约时段');
  if (!appointmentType || !appointmentType.trim()) throw new Error('请选择预约类型');
  if (!name || !name.trim()) throw new Error('请输入姓名');
  if (!/^1\d{10}$/.test((phone || '').trim())) throw new Error('请输入正确的11位手机号');
  if (!request || !request.trim()) throw new Error('请输入预约需求');
  const contentError = getBookingContentError({ name, request });
  if (contentError) throw new Error(contentError);
  if (!privacyConsent) throw new Error('请先阅读并同意《隐私政策》');
  if (!agreementConsent) throw new Error('请先阅读并同意《用户协议》');
}
async function getAppData(openid, event = {}) {
  const settings = await ensureSettings();
  const now = getChinaNow();
  const baseDateOptions = buildUpcomingDateOptions(settings, now);
  const serviceDates = baseDateOptions.map((item) => item.serviceDate);
  const [myAppointments, allAppointments, rawStaffProfile, semesterSummary] = await Promise.all([
    getMyAppointments(openid, settings, now),
    getAppointmentsByServiceDates(serviceDates),
    getStaffProfile(openid),
    getSemesterSummary(settings)
  ]);
  const myActiveAppointmentDates = new Set(myAppointments.filter((item) => item.status === 'booked' || item.status === 'completed').map((item) => item.serviceDate));
  const dateOptions = baseDateOptions.map((item) => ({ ...item, hasMyAppointment: myActiveAppointmentDates.has(item.serviceDate) }));
  const selectedDateOption = pickSelectedDate(event.selectedDate, dateOptions);
  const selectedDateAppointments = selectedDateOption ? allAppointments.filter((item) => item.serviceDate === selectedDateOption.serviceDate) : [];
  const slots = selectedDateOption ? buildSlotStatus(parseDateString(selectedDateOption.serviceDate), selectedDateOption, selectedDateAppointments, settings, now) : [];
  const scheduleOverview = buildScheduleOverview(dateOptions, allAppointments, settings, now);
  const slotOptionsByDate = scheduleOverview.map((item) => ({
    serviceDate: item.serviceDate,
    serviceDateLabel: item.serviceDateLabel,
    slots: item.slots
  }));
  const staffProfile = normalizeStaffProfile(rawStaffProfile);
  const isAdmin = isAdminOpenId(openid, settings);

  let groupSchedules = [];
  if (staffProfile.isStaff && staffProfile.groupId) {
    groupSchedules = scheduleOverview
      .filter((item) => item.groupId === staffProfile.groupId)
      .map((schedule) => ({
        ...schedule,
        appointments: allAppointments
          .filter((item) => item.status !== 'cancelled' && item.serviceDate === schedule.serviceDate && getAppointmentGroupInfo(item, settings).groupId === staffProfile.groupId)
          .map((item) => decorateAppointment(item, settings, now))
          .sort(sortAppointmentsBySlot)
      }));
  }

  return {
    selectedDate: selectedDateOption ? selectedDateOption.serviceDate : '',
    selectedDateLabel: selectedDateOption ? selectedDateOption.serviceDateLabel : '',
    dateOptions,
    slots,
    summary: {
      totalCount: TOTAL_CAPACITY_PER_DATE,
      bookedCount: selectedDateAppointments.filter((item) => item.status === 'booked' || item.status === 'completed').length,
      completedCount: selectedDateAppointments.filter((item) => item.status === 'completed').length,
      availableCount: slots.reduce((sum, item) => sum + (item.status === 'available' ? item.remainingCount : 0), 0)
    },
    semesterSummary,
    scheduleOverview,
    slotOptionsByDate,
    myAppointments,
    staffProfile,
    groupOptions: GROUP_OPTIONS,
    groupSchedules,
    permissions: { isAdmin },
    staffBindingCodeEnabled: Boolean(settings.staffBindingCode),
    semesterConfig: {
      semesterStartDate: settings.semesterStartDate,
      dutyStartWeek: settings.dutyStartWeek
    },
    adminConfigReady: settings.adminOpenIds.length > 0
  };
}

async function getHomeData(event = {}) {
  const settings = await ensureSettings();
  const now = getChinaNow();
  const dateOptions = buildUpcomingDateOptions(settings, now);
  const serviceDates = dateOptions.map((item) => item.serviceDate);
  const [allAppointments, semesterSummary] = await Promise.all([
    getAppointmentsByServiceDates(serviceDates),
    getSemesterSummary(settings)
  ]);
  const selectedDateOption = pickSelectedDate(event.selectedDate, dateOptions);
  const selectedDateAppointments = selectedDateOption ? allAppointments.filter((item) => item.serviceDate === selectedDateOption.serviceDate) : [];
  const slots = selectedDateOption ? buildSlotStatus(parseDateString(selectedDateOption.serviceDate), selectedDateOption, selectedDateAppointments, settings, now) : [];
  const scheduleOverview = buildScheduleOverview(dateOptions, allAppointments, settings, now);

  return {
    selectedDate: selectedDateOption ? selectedDateOption.serviceDate : '',
    selectedDateLabel: selectedDateOption ? selectedDateOption.serviceDateLabel : '',
    summary: {
      totalCount: TOTAL_CAPACITY_PER_DATE,
      bookedCount: selectedDateAppointments.filter((item) => item.status === 'booked' || item.status === 'completed').length,
      completedCount: selectedDateAppointments.filter((item) => item.status === 'completed').length,
      availableCount: slots.reduce((sum, item) => sum + (item.status === 'available' ? item.remainingCount : 0), 0)
    },
    semesterSummary,
    scheduleOverview
  };
}

async function getBookingData(openid, event = {}) {
  const settings = await ensureSettings();
  const now = getChinaNow();
  const baseDateOptions = buildUpcomingDateOptions(settings, now);
  const serviceDates = baseDateOptions.map((item) => item.serviceDate);
  const [myAppointments, allAppointments] = await Promise.all([
    getMyAppointments(openid, settings, now),
    getAppointmentsByServiceDates(serviceDates)
  ]);
  const myActiveAppointmentDates = new Set(myAppointments.filter((item) => item.status === 'booked' || item.status === 'completed').map((item) => item.serviceDate));
  const dateOptions = baseDateOptions.map((item) => ({ ...item, hasMyAppointment: myActiveAppointmentDates.has(item.serviceDate) }));
  const selectedDateOption = pickSelectedDate(event.selectedDate, dateOptions);
  const selectedDateAppointments = selectedDateOption ? allAppointments.filter((item) => item.serviceDate === selectedDateOption.serviceDate) : [];
  const slots = selectedDateOption ? buildSlotStatus(parseDateString(selectedDateOption.serviceDate), selectedDateOption, selectedDateAppointments, settings, now) : [];
  const scheduleOverview = buildScheduleOverview(dateOptions, allAppointments, settings, now);
  const slotOptionsByDate = scheduleOverview.map((item) => ({
    serviceDate: item.serviceDate,
    serviceDateLabel: item.serviceDateLabel,
    slots: item.slots
  }));

  return {
    selectedDate: selectedDateOption ? selectedDateOption.serviceDate : '',
    selectedDateLabel: selectedDateOption ? selectedDateOption.serviceDateLabel : '',
    dateOptions,
    slots,
    slotOptionsByDate,
    myAppointments
  };
}

async function getBookingQueryData(openid) {
  const settings = await ensureSettings();
  const now = getChinaNow();
  const [rawMyAppointments] = await Promise.all([
    getMyAppointments(openid, settings, now)
  ]);
  const myAppointments = rawMyAppointments.filter((item) => item.status !== 'cancelled');
  const dutyDateOptions = buildSemesterDutyPreview(settings)
    .filter((item) => item.dutyStarted)
    .map((item) => ({
      serviceDate: item.serviceDate,
      serviceDateLabel: item.serviceDateLabel,
      weekNo: item.weekNo,
      groupId: item.groupId,
      groupName: item.groupName,
      isManuallyClosed: item.isManuallyClosed,
      description: item.description
    }));

  return {
    myAppointments,
    dutyDateOptions
  };
}

async function getUserData(openid) {
  const settings = await ensureSettings();
  const rawStaffProfile = await getStaffProfile(openid);
  const staffProfile = normalizeStaffProfile(rawStaffProfile);
  const isAdmin = isAdminOpenId(openid, settings);

  return {
    staffProfile,
    permissions: { isAdmin },
    staffBindingCodeEnabled: Boolean(settings.staffBindingCode)
  };
}

async function getUserDutySchedules(openid) {
  const settings = await ensureSettings();
  const now = getChinaNow();
  const staffProfile = normalizeStaffProfile(await getStaffProfile(openid));

  if (!staffProfile.isStaff || !staffProfile.groupId) {
    return {
      staffProfile,
      groupSchedules: []
    };
  }

  const currentWeekDutySchedule = buildDutyCheckInDateOptions(settings)
    .find((item) => item.groupId === staffProfile.groupId && item.dutyStarted && isCurrentWeekServiceDate(item.serviceDateObj, now));

  const nextDutySchedule = currentWeekDutySchedule || buildUpcomingDateOptions(settings, now)
    .find((item) => item.groupId === staffProfile.groupId && item.dutyStarted && !item.isManuallyClosed);

  if (!nextDutySchedule) {
    return {
      staffProfile,
      groupSchedules: []
    };
  }

  const allAppointments = await getAppointmentsByServiceDates([nextDutySchedule.serviceDate]);
  const scheduleAppointments = allAppointments
    .filter((item) => item.status !== 'cancelled' && item.serviceDate === nextDutySchedule.serviceDate)
    .map((item) => decorateAppointment(item, settings, now))
    .sort(sortAppointmentsBySlot);

  const bookedCount = scheduleAppointments.filter((item) => item.status === 'booked').length;
  const completedCount = scheduleAppointments.filter((item) => item.status === 'completed').length;
  const slots = buildSlotStatus(parseDateString(nextDutySchedule.serviceDate), nextDutySchedule, allAppointments.filter((item) => item.serviceDate === nextDutySchedule.serviceDate), settings, now);
  const availableCount = slots.reduce((sum, item) => sum + (item.status === 'available' ? item.remainingCount : 0), 0);
  const summaryText = !nextDutySchedule.dutyStarted ? '未开始' : nextDutySchedule.isManuallyClosed ? '已关闭' : `剩余 ${availableCount}/${TOTAL_CAPACITY_PER_DATE}`;
  const groupSchedules = [{
    ...nextDutySchedule,
    bookedCount,
    completedCount,
    availableCount,
    summaryText,
    slots,
    manageKey: nextDutySchedule.serviceDate,
    appointments: scheduleAppointments
  }];

  return {
    staffProfile,
    groupSchedules
  };
}

async function getAdminDashboardData(openid) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const profileResult = await db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
  const profiles = profileResult.data || [];
  const staffRequestCount = profiles.filter((item) => normalizeStaffStatus(item) === 'pending').length;
  const staffMemberCount = profiles.filter((item) => normalizeStaffStatus(item) === 'approved').length;

  return {
    staffRequestCount,
    staffMemberCount,
    semesterConfig: {
      semesterStartDate: settings.semesterStartDate,
      dutyStartWeek: settings.dutyStartWeek
    }
  };
}

async function getStaffRequestAdminData(openid) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const profileResult = await db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
  const profiles = profileResult.data || [];
  const staffRequests = profiles.filter((item) => normalizeStaffStatus(item) === 'pending').map((item) => ({
    openId: item._id,
    staffName: item.staffName || '',
    status: 'pending',
    appliedAt: item.appliedAt || null,
    updatedAt: item.updatedAt || null
  }));

  return {
    groupOptions: GROUP_OPTIONS,
    staffBindingCode: settings.staffBindingCode,
    staffRequests
  };
}

async function getStaffGroupAdminData(openid) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const profileResult = await db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
  const profiles = profileResult.data || [];
  const staffMembers = profiles.filter((item) => normalizeStaffStatus(item) === 'approved').map((item) => {
    const profile = normalizeStaffProfile(item);
    return {
      openId: item._id,
      staffName: profile.staffName,
      groupId: profile.groupId,
      groupName: profile.groupName,
      approvedAt: item.approvedAt || null,
      updatedAt: item.updatedAt || null
    };
  });

  return {
    groupOptions: GROUP_OPTIONS,
    staffMembers
  };
}

async function getAdminBookingQueryData(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const now = getChinaNow();
  const dutyDateOptions = buildDutyCheckInDateOptions(settings);
  const selectedDutyDate = pickAdminBookingQueryDate(event.selectedDate, dutyDateOptions, now);
  const selectedDate = selectedDutyDate ? selectedDutyDate.serviceDate : '';
  const appointments = selectedDate
    ? (await getAppointmentsByServiceDates([selectedDate]))
      .filter((item) => item.status !== 'cancelled')
      .map((item) => decorateAppointment(item, settings, now))
      .sort(sortAdminQueryAppointments)
    : [];

  return {
    selectedDate,
    selectedDutyDate: selectedDutyDate ? {
      serviceDate: selectedDutyDate.serviceDate,
      serviceDateLabel: selectedDutyDate.serviceDateLabel,
      weekNo: selectedDutyDate.weekNo,
      groupId: selectedDutyDate.groupId,
      groupName: selectedDutyDate.groupName,
      isManuallyClosed: selectedDutyDate.isManuallyClosed,
      description: selectedDutyDate.description
    } : null,
    dutyDateOptions: dutyDateOptions.map((item) => ({
      serviceDate: item.serviceDate,
      serviceDateLabel: item.serviceDateLabel,
      weekNo: item.weekNo,
      groupId: item.groupId,
      groupName: item.groupName,
      isManuallyClosed: item.isManuallyClosed,
      description: item.description
    })),
    summary: {
      totalCount: appointments.length,
      bookedCount: appointments.filter((item) => item.status === 'booked').length,
      completedCount: appointments.filter((item) => item.status === 'completed').length
    },
    appointments
  };
}

async function getAdminData(openid) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const now = getChinaNow();
  const dateOptions = buildAdminManageDateOptions(settings, now);
  const [appointments, profileResult] = await Promise.all([
    getAppointmentsByServiceDates(dateOptions.map((item) => item.serviceDate)),
    db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get()
  ]);
  const scheduleOverview = buildScheduleOverview(dateOptions, appointments, settings, now);
  const semesterDutyPreview = buildSemesterDutyPreview(settings);
  const profiles = profileResult.data || [];

  const staffRequests = profiles.filter((item) => normalizeStaffStatus(item) === 'pending').map((item) => ({
    openId: item._id,
    staffName: item.staffName || '',
    status: 'pending',
    appliedAt: item.appliedAt || null,
    updatedAt: item.updatedAt || null
  }));

  const staffMembers = profiles.filter((item) => normalizeStaffStatus(item) === 'approved').map((item) => {
    const profile = normalizeStaffProfile(item);
    return {
      openId: item._id,
      staffName: profile.staffName,
      groupId: profile.groupId,
      groupName: profile.groupName,
      approvedAt: item.approvedAt || null,
      updatedAt: item.updatedAt || null
    };
  });

  return {
    groupOptions: GROUP_OPTIONS,
    semesterConfig: {
      semesterStartDate: settings.semesterStartDate,
      dutyStartWeek: settings.dutyStartWeek
    },
    staffBindingCode: settings.staffBindingCode,
    semesterDutyPreview,
    scheduleOverview,
    staffRequests,
    staffMembers,
    adminOpenIds: settings.adminOpenIds
  };
}

async function getDutyCheckInAdminData(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const now = getChinaNow();
  const dutyDateOptions = buildDutyCheckInDateOptions(settings);
  const selectedDutyDate = pickDutyCheckInDate(event.selectedDate, dutyDateOptions, now);
  const [approvedStaffMembers, signInRecords] = await Promise.all([
    getApprovedStaffMembers(),
    getDutySignInByServiceDates(dutyDateOptions.map((item) => item.serviceDate))
  ]);
  const dutyDates = buildDutyCheckInSummaryByDate(dutyDateOptions, approvedStaffMembers, signInRecords);
  const selectedSignInRecord = selectedDutyDate ? signInRecords.find((item) => item.serviceDate === selectedDutyDate.serviceDate) : null;
  const { signedMembers, unsignedMembers } = buildDutyCheckInMemberLists(selectedDutyDate, approvedStaffMembers, selectedSignInRecord);
  const canGenerateQrCode = selectedDutyDate ? canGenerateDutyCheckInQrCode(selectedDutyDate.serviceDateObj, now) : false;
  const qrCodeFileID = canGenerateQrCode && selectedSignInRecord && selectedSignInRecord.qrCodeFileID ? selectedSignInRecord.qrCodeFileID : '';

  return {
    selectedDate: selectedDutyDate ? selectedDutyDate.serviceDate : '',
    selectedDutyDate: selectedDutyDate ? {
      ...selectedDutyDate,
      canGenerateQrCode,
      qrCodeFileID
    } : null,
    dutyDates,
    signedMembers,
    unsignedMembers
  };
}

async function getDutyCheckInDetail(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const now = getChinaNow();
  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const dutyDateOptions = buildDutyCheckInDateOptions(settings);
  const selectedDutyDate = dutyDateOptions.find((item) => item.serviceDate === serviceDate);
  if (!selectedDutyDate) {
    throw new Error('未找到对应值班日期');
  }

  const [approvedStaffMembers, signInRecord] = await Promise.all([
    getApprovedStaffMembers(),
    getDutySignInByServiceDate(serviceDate)
  ]);
  const { signedMembers, unsignedMembers } = buildDutyCheckInMemberLists(selectedDutyDate, approvedStaffMembers, signInRecord);
  const canGenerateQrCode = canGenerateDutyCheckInQrCode(selectedDutyDate.serviceDateObj, now);

  return {
    selectedDate: selectedDutyDate.serviceDate,
    selectedDutyDate: {
      ...selectedDutyDate,
      canGenerateQrCode,
      qrCodeFileID: canGenerateQrCode && signInRecord && signInRecord.qrCodeFileID ? signInRecord.qrCodeFileID : ''
    },
    signedMembers,
    unsignedMembers
  };
}

async function getDutyCheckInQrCode(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const now = getChinaNow();
  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const scheduleInfo = getScheduleInfoByServiceDate(serviceDate, settings);
  if (!scheduleInfo.dutyStarted) {
    throw new Error('该日期尚未安排值班');
  }
  if (!canGenerateDutyCheckInQrCode(scheduleInfo.serviceDateObj, now)) {
    throw new Error('仅本周且尚未结束的值班日期可生成签到二维码');
  }

  const signInRecord = await getDutySignInByServiceDate(serviceDate);
  const qrCodeFileID = await ensureDutyCheckInQrCode(serviceDate, scheduleInfo, signInRecord);
  return {
    serviceDate,
    qrCodeFileID
  };
}

async function getDutyCheckInPageData(openid, event = {}) {
  const settings = await ensureSettings();
  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const scheduleInfo = getScheduleInfoByServiceDate(serviceDate, settings);
  const [rawStaffProfile, signInRecord] = await Promise.all([
    getStaffProfile(openid),
    getDutySignInByServiceDate(serviceDate)
  ]);
  const staffProfile = normalizeStaffProfile(rawStaffProfile);
  const currentRecord = signInRecord && Array.isArray(signInRecord.records)
    ? signInRecord.records.find((item) => item.openId === openid)
    : null;
  const now = getChinaNow();

  let canCheckIn = true;
  let disabledReason = '';

  if (!staffProfile.isStaff || !staffProfile.groupId) {
    canCheckIn = false;
    disabledReason = '你当前不是服务人员，无法签到';
  } else if (!scheduleInfo.dutyStarted) {
    canCheckIn = false;
    disabledReason = '该日期尚未安排值班';
  } else if (staffProfile.groupId !== scheduleInfo.groupId) {
    canCheckIn = false;
    disabledReason = '你的分组与该值班日期不匹配，无法签到';
  } else if (currentRecord) {
    canCheckIn = false;
    disabledReason = '你已完成签到';
  } else if (!isDutyCheckInOpen(scheduleInfo.serviceDateObj, now)) {
    canCheckIn = false;
    disabledReason = now < getChinaDateStart(scheduleInfo.serviceDateObj) ? '未到签到时间' : '签到已结束';
  }

  return {
    serviceDate: scheduleInfo.serviceDate,
    serviceDateLabel: scheduleInfo.serviceDateLabel,
    weekNo: scheduleInfo.weekNo,
    groupId: scheduleInfo.groupId,
    groupName: scheduleInfo.groupName,
    dutyText: `${scheduleInfo.groupName}值班`,
    staffProfile,
    signed: Boolean(currentRecord),
    signedAtLabel: currentRecord && currentRecord.signedAtLabel ? currentRecord.signedAtLabel : '',
    canCheckIn,
    disabledReason
  };
}

async function submitDutyCheckIn(openid, event = {}) {
  const settings = await ensureSettings();
  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const scheduleInfo = getScheduleInfoByServiceDate(serviceDate, settings);
  const staffProfile = normalizeStaffProfile(await getStaffProfile(openid));
  const now = getChinaNow();

  if (!staffProfile.isStaff || !staffProfile.groupId) throw new Error('你当前不是服务人员，无法签到');
  if (!scheduleInfo.dutyStarted) throw new Error('该日期尚未安排值班');
  if (staffProfile.groupId !== scheduleInfo.groupId) throw new Error('你的分组与该值班日期不匹配，无法签到');
  if (!isDutyCheckInOpen(scheduleInfo.serviceDateObj, now)) {
    throw new Error(now < getChinaDateStart(scheduleInfo.serviceDateObj) ? '未到签到时间' : '签到已结束');
  }

  const docRef = db.collection(DUTY_SIGNINS_COLLECTION).doc(serviceDate);
  const existing = await getDutySignInByServiceDate(serviceDate);
  const records = existing && Array.isArray(existing.records) ? existing.records.slice() : [];
  if (records.some((item) => item.openId === openid)) {
    return { serviceDate, signed: true, signedAtLabel: records.find((item) => item.openId === openid).signedAtLabel };
  }

  const nextRecord = {
    openId: openid,
    staffName: staffProfile.staffName || '服务人员',
    groupId: staffProfile.groupId,
    groupName: staffProfile.groupName,
    signedAtMillis: now.getTime(),
    signedAtLabel: formatDateTimeLabel(now)
  };
  const nextData = {
    serviceDate,
    weekNo: scheduleInfo.weekNo,
    groupId: scheduleInfo.groupId,
    groupName: scheduleInfo.groupName,
    records: records.concat(nextRecord),
    updatedAt: db.serverDate()
  };

  if (existing) {
    await docRef.update({ data: nextData });
  } else {
    await docRef.set({ data: nextData });
  }

  return {
    serviceDate,
    signed: true,
    signedAtLabel: nextRecord.signedAtLabel
  };
}

async function updateDutyCheckInStatus(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const targetOpenId = String(event.targetOpenId || '').trim();
  const signed = Boolean(event.signed);
  if (!targetOpenId) throw new Error('缺少服务人员标识');

  const scheduleInfo = getScheduleInfoByServiceDate(serviceDate, settings);
  if (!scheduleInfo.dutyStarted) throw new Error('该日期尚未安排值班');

  const staffProfile = normalizeStaffProfile(await getStaffProfile(targetOpenId));
  if (!staffProfile.isStaff || !staffProfile.groupId) throw new Error('该成员当前不是服务人员');
  if (staffProfile.groupId !== scheduleInfo.groupId) throw new Error('该成员不属于当前值班组');

  const docRef = db.collection(DUTY_SIGNINS_COLLECTION).doc(serviceDate);
  const existing = await getDutySignInByServiceDate(serviceDate);
  const records = existing && Array.isArray(existing.records) ? existing.records.slice() : [];
  const nextRecords = records.filter((item) => item.openId !== targetOpenId);

  if (signed) {
    const now = getChinaNow();
    nextRecords.push({
      openId: targetOpenId,
      staffName: staffProfile.staffName || '服务人员',
      groupId: staffProfile.groupId,
      groupName: staffProfile.groupName,
      signedAtMillis: now.getTime(),
      signedAtLabel: formatDateTimeLabel(now),
      updatedByAdmin: true
    });
  }

  const nextData = {
    serviceDate,
    weekNo: scheduleInfo.weekNo,
    groupId: scheduleInfo.groupId,
    groupName: scheduleInfo.groupName,
    records: nextRecords,
    updatedAt: db.serverDate()
  };

  if (existing) {
    await docRef.update({ data: nextData });
  } else {
    await docRef.set({ data: nextData });
  }

  return {
    serviceDate,
    targetOpenId,
    signed
  };
}

async function exportDutyCheckInReport(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const dutyDateOptions = buildDutyCheckInDateOptions(settings);
  const selectedDutyDate = dutyDateOptions.find((item) => item.serviceDate === serviceDate);
  if (!selectedDutyDate) throw new Error('未找到对应值班日期');

  const profileResult = await db.collection(STAFF_PROFILE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get();
  const approvedStaffMembers = (profileResult.data || [])
    .filter((item) => normalizeStaffStatus(item) === 'approved')
    .map((item) => normalizeStaffProfile(item));
  const signInRecord = await getDutySignInByServiceDate(serviceDate);
  const { signedMembers, unsignedMembers } = buildDutyCheckInMemberLists(selectedDutyDate, approvedStaffMembers, signInRecord);
  const fileBuffer = buildDutyCheckInExportBuffer(selectedDutyDate, signedMembers, unsignedMembers);
  const fileName = `值班签到-${serviceDate}.xls`;
  const uploadResult = await cloud.uploadFile({
    cloudPath: `exports/duty-checkins/${serviceDate}-${Date.now()}.xls`,
    fileContent: fileBuffer
  });

  return {
    fileID: uploadResult.fileID,
    fileName
  };
}

async function createAppointment(openid, event) {
  validateBookingInput(event);
  const normalizedName = normalizeBookingText(event.name);
  const normalizedRequest = normalizeBookingText(event.request);
  await assertMessageContentSafe(openid, `${normalizedName}\n${normalizedRequest}`);
  const settings = await ensureSettings();
  const now = getChinaNow();
  const scheduleInfo = getScheduleInfoByServiceDate(event.serviceDate, settings);
  const targetSlot = getSlotDefinitions(scheduleInfo.serviceDateObj).find((item) => item.id === event.slotId);

  if (!scheduleInfo.dutyStarted) throw new Error('该日期尚未开放值班');
  if (!targetSlot) throw new Error('预约时段不存在');
  if (isDateManuallyClosed(settings, scheduleInfo.serviceDate)) throw new Error('该日预约已由管理员关闭');
  if (now >= targetSlot.start) throw new Error('该时段已停止预约');

  const [slotAppointment, mySameDateAppointment] = await Promise.all([
    db.collection(APPOINTMENTS_COLLECTION)
      .where({ serviceDate: scheduleInfo.serviceDate, slotId: event.slotId, status: _.in(['booked', 'completed']) })
      .limit(MAX_APPOINTMENTS_PER_SLOT)
      .get(),
    db.collection(APPOINTMENTS_COLLECTION)
      .where({ serviceDate: scheduleInfo.serviceDate, userOpenId: openid, status: _.in(['booked', 'completed']) })
      .limit(1)
      .get()
  ]);

  if (slotAppointment.data.length >= MAX_APPOINTMENTS_PER_SLOT) {
    throw new Error(`该时段预约人数已满（最多 ${MAX_APPOINTMENTS_PER_SLOT} 人）`);
  }

  if (mySameDateAppointment.data.length > 0) {
    throw new Error('你在该日期已经提交过预约');
  }

  await db.collection(APPOINTMENTS_COLLECTION).add({
    data: {
      userOpenId: openid,
      weekKey: scheduleInfo.serviceDate,
      serviceDate: scheduleInfo.serviceDate,
      serviceDateLabel: scheduleInfo.serviceDateLabel,
      weekNo: scheduleInfo.weekNo,
      groupId: scheduleInfo.groupId,
      groupName: scheduleInfo.groupName,
      slotId: targetSlot.id,
      slotLabel: targetSlot.label,
      appointmentType: event.appointmentType.trim(),
      name: normalizedName,
      phone: event.phone.trim(),
      request: normalizedRequest,
      privacyConsent: true,
      agreementConsent: true,
      status: 'booked',
      createdAt: db.serverDate()
    }
  });

  return { serviceDate: scheduleInfo.serviceDate, slotId: targetSlot.id, slotLabel: targetSlot.label };
}

async function cancelAppointment(openid, event = {}) {
  const appointmentId = event.appointmentId;
  const asAdmin = Boolean(event.asAdmin);
  if (!appointmentId) throw new Error('缺少预约单信息');

  const settings = await ensureSettings();
  const appointmentResult = await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).get();
  const appointment = appointmentResult.data;
  if (!appointment) throw new Error('预约单不存在');
  if (appointment.status === 'completed') throw new Error('已结单预约不能取消');
  if (appointment.status === 'cancelled') throw new Error('该预约已取消');

  if (asAdmin) {
    assertAdmin(openid, settings);
  } else {
    if (appointment.userOpenId !== openid) throw new Error('只能取消自己的预约');
    const decorated = decorateAppointment(appointment, settings, getChinaNow());
    if (!decorated.canCancel) throw new Error('预约日期当天及之后不可取消');
  }

  await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).update({ data: { status: 'cancelled', cancelledAt: db.serverDate() } });
  return { appointmentId };
}

async function adminUpdateAppointmentStatus(openid, event = {}) {
  const appointmentId = String(event.appointmentId || '').trim();
  const targetStatus = String(event.status || '').trim();
  if (!appointmentId) throw new Error('缺少预约单信息');
  if (!['booked', 'completed', 'cancelled'].includes(targetStatus)) {
    throw new Error('目标预约状态无效');
  }

  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const appointmentResult = await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).get();
  const appointment = appointmentResult.data;
  if (!appointment) throw new Error('预约单不存在');
  if (appointment.status === targetStatus) {
    throw new Error('预约状态未发生变化');
  }
  if (appointment.status === 'completed' && targetStatus === 'cancelled') {
    throw new Error('已结单预约无法取消');
  }

  const updatePayload = {
    status: targetStatus
  };

  if (targetStatus === 'completed') {
    updatePayload.closedAt = db.serverDate();
    updatePayload.closedBy = '管理员';
  } else {
    updatePayload.closedAt = null;
    updatePayload.closedBy = '';
  }

  if (targetStatus === 'cancelled') {
    updatePayload.cancelledAt = db.serverDate();
  } else {
    updatePayload.cancelledAt = null;
  }

  await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).update({
    data: updatePayload
  });

  return {
    appointmentId,
    status: targetStatus
  };
}

async function submitStaffRequest(openid, event = {}) {
  const settings = await ensureSettings();
  const staffName = String(event.staffName || '').trim();
  const bindingCode = String(event.bindingCode || '').trim();
  if (!staffName) throw new Error('请输入服务人员姓名');
  if (!settings.staffBindingCode) throw new Error('管理员尚未设置绑定码，请联系管理员');
  if (!bindingCode) throw new Error('请输入绑定码');
  if (bindingCode !== settings.staffBindingCode) throw new Error('绑定码错误');

  const docRef = db.collection(STAFF_PROFILE_COLLECTION).doc(openid);
  const existing = await getStaffProfile(openid);
  const status = normalizeStaffStatus(existing);
  if (status === 'approved') throw new Error('你已经是服务人员');

  const nextData = {
    staffName,
    status: 'pending',
    isStaff: false,
    groupId: 0,
    rejectReason: '',
    appliedAt: existing && existing.appliedAt ? existing.appliedAt : db.serverDate(),
    updatedAt: db.serverDate()
  };

  if (existing) {
    await docRef.update({ data: nextData });
  } else {
    await docRef.set({ data: nextData });
  }

  return { status: 'pending', staffName };
}
async function updateStaffBindingCode(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const staffBindingCode = String(event.staffBindingCode || '').trim();
  if (!staffBindingCode) throw new Error('请输入绑定码');

  await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).update({
    data: {
      staffBindingCode,
      updatedAt: db.serverDate()
    }
  });
  return { staffBindingCode };
}
async function reviewStaffRequest(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const targetOpenId = String(event.targetOpenId || '').trim();
  const action = String(event.reviewAction || '').trim();
  const groupId = Number(event.groupId);
  if (!targetOpenId) throw new Error('缺少服务人员标识');
  if (!['approve', 'reject'].includes(action)) throw new Error('审批动作不支持');

  const existing = await getStaffProfile(targetOpenId);
  if (!existing) throw new Error('服务人员申请不存在');

  const docRef = db.collection(STAFF_PROFILE_COLLECTION).doc(targetOpenId);
  if (action === 'approve') {
    if (!GROUP_OPTIONS.find((item) => item.id === groupId)) throw new Error('请选择有效分组');
    await docRef.update({
      data: {
        status: 'approved',
        isStaff: true,
        groupId,
        rejectReason: '',
        approvedAt: db.serverDate(),
        reviewedAt: db.serverDate(),
        reviewedBy: openid,
        updatedAt: db.serverDate()
      }
    });
    return { targetOpenId, status: 'approved', groupId, groupName: getGroupName(groupId) };
  }

  await docRef.update({
    data: {
      status: 'rejected',
      isStaff: false,
      groupId: 0,
      reviewedAt: db.serverDate(),
      reviewedBy: openid,
      updatedAt: db.serverDate()
    }
  });
  return { targetOpenId, status: 'rejected' };
}

async function updateStaffGroup(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const targetOpenId = String(event.targetOpenId || '').trim();
  const groupId = Number(event.groupId);
  if (!targetOpenId) throw new Error('缺少服务人员标识');
  if (!GROUP_OPTIONS.find((item) => item.id === groupId)) throw new Error('请选择有效分组');

  const existing = await getStaffProfile(targetOpenId);
  if (!existing || normalizeStaffStatus(existing) !== 'approved') throw new Error('该用户不是已审批服务人员');

  await db.collection(STAFF_PROFILE_COLLECTION).doc(targetOpenId).update({
    data: {
      groupId,
      updatedAt: db.serverDate()
    }
  });
  return { targetOpenId, groupId, groupName: getGroupName(groupId) };
}

async function batchUpdateStaffGroup(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const targetOpenIds = Array.from(new Set((Array.isArray(event.targetOpenIds) ? event.targetOpenIds : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)));
  const groupId = Number(event.groupId);

  if (!targetOpenIds.length) throw new Error('请选择至少一名服务人员');
  if (!GROUP_OPTIONS.find((item) => item.id === groupId)) throw new Error('请选择有效分组');

  const profiles = await Promise.all(targetOpenIds.map((targetOpenId) => getStaffProfile(targetOpenId)));
  const invalidOpenIds = targetOpenIds.filter((targetOpenId, index) => {
    const profile = profiles[index];
    return !profile || normalizeStaffStatus(profile) !== 'approved';
  });
  if (invalidOpenIds.length) {
    throw new Error('所选成员中存在非已审批服务人员，请刷新后重试');
  }

  await Promise.all(targetOpenIds.map((targetOpenId) => db.collection(STAFF_PROFILE_COLLECTION).doc(targetOpenId).update({
    data: {
      groupId,
      updatedAt: db.serverDate()
    }
  })));

  return {
    count: targetOpenIds.length,
    groupId,
    groupName: getGroupName(groupId),
    targetOpenIds
  };
}

async function removeStaffBinding(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);

  const targetOpenId = String(event.targetOpenId || '').trim();
  if (!targetOpenId) throw new Error('缺少服务人员标识');

  const existing = await getStaffProfile(targetOpenId);
  if (!existing || normalizeStaffStatus(existing) !== 'approved') throw new Error('该用户不是已审批服务人员');

  await db.collection(STAFF_PROFILE_COLLECTION).doc(targetOpenId).update({
    data: {
      status: 'none',
      isStaff: false,
      groupId: 0,
      rejectReason: '',
      approvedAt: null,
      reviewedAt: db.serverDate(),
      reviewedBy: openid,
      updatedAt: db.serverDate()
    }
  });
  return { targetOpenId, status: 'none' };
}

async function completeAppointment(openid, event = {}) {
  const appointmentId = event.appointmentId;
  if (!appointmentId) throw new Error('缺少预约单信息');

  const settings = await ensureSettings();
  const appointmentResult = await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).get();
  const appointment = appointmentResult.data;
  const staffProfile = normalizeStaffProfile(await getStaffProfile(openid));

  if (!appointment) throw new Error('预约单不存在');
  if (!staffProfile.isStaff || !staffProfile.groupId) throw new Error('你当前没有结单权限');
  if (appointment.status === 'completed') throw new Error('该预约单已结单');
  if (appointment.status === 'cancelled') throw new Error('已取消预约不能结单');

  const appointmentGroupId = getAppointmentGroupInfo(appointment, settings).groupId;
  if (appointmentGroupId !== staffProfile.groupId) throw new Error('你没有该预约的结单权限');

  await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentId).update({
    data: {
      status: 'completed',
      closedAt: db.serverDate(),
      closedBy: staffProfile.staffName || '服务人员'
    }
  });
  return { appointmentId };
}

async function updateSemesterConfig(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const semesterStartDate = String(event.semesterStartDate || '').trim();
  const dutyStartWeek = Number(event.dutyStartWeek);
  if (!semesterStartDate) throw new Error('请选择学期开始日期');
  parseDateString(semesterStartDate);
  if (!Number.isInteger(dutyStartWeek) || dutyStartWeek < 1) throw new Error('值班开始周必须是大于 0 的整数');

  await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).update({
    data: {
      semesterStartDate,
      dutyStartWeek,
      updatedAt: db.serverDate()
    }
  });
  return { semesterStartDate, dutyStartWeek };
}

async function updateDateAvailability(openid, event = {}) {
  const settings = await ensureSettings();
  assertAdmin(openid, settings);
  const serviceDate = formatDate(parseDateString(event.serviceDate));
  const isOpen = Boolean(event.isOpen);
  const scheduleInfo = getScheduleInfoByServiceDate(serviceDate, settings);
  if (!scheduleInfo.dutyStarted) throw new Error('该日期尚未开放值班');
  if (!isServiceDateNotStarted(scheduleInfo.serviceDateObj, getChinaNow())) throw new Error('该日期值班已开始，不能再调整预约开关');

  const closedDates = normalizeClosedDates(settings.closedDates);
  const nextClosedDates = isOpen ? closedDates.filter((item) => item !== serviceDate) : normalizeClosedDates([...closedDates, serviceDate]);
  await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).update({ data: { closedDates: nextClosedDates, updatedAt: db.serverDate() } });
  return { serviceDate, isOpen, closedDates: nextClosedDates };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    switch (event.action) {
      case 'getOpenId':
        return {
          success: true,
          data: {
            openid: OPENID
          }
        };
      case 'getAppData':
        return { success: true, data: await getAppData(OPENID, event) };
      case 'getHomeData':
        return { success: true, data: await getHomeData(event) };
      case 'getBookingData':
        return { success: true, data: await getBookingData(OPENID, event) };
      case 'getBookingQueryData':
        return { success: true, data: await getBookingQueryData(OPENID) };
      case 'getUserData':
        return { success: true, data: await getUserData(OPENID) };
      case 'getUserDutySchedules':
        return { success: true, data: await getUserDutySchedules(OPENID) };
      case 'getAdminDashboardData':
        return { success: true, data: await getAdminDashboardData(OPENID) };
      case 'getStaffRequestAdminData':
        return { success: true, data: await getStaffRequestAdminData(OPENID) };
      case 'getStaffGroupAdminData':
        return { success: true, data: await getStaffGroupAdminData(OPENID) };
      case 'getAdminBookingQueryData':
        return { success: true, data: await getAdminBookingQueryData(OPENID, event) };
      case 'getAdminData':
        return { success: true, data: await getAdminData(OPENID) };
      case 'getDutyCheckInAdminData':
        return { success: true, data: await getDutyCheckInAdminData(OPENID, event) };
      case 'getDutyCheckInDetail':
        return { success: true, data: await getDutyCheckInDetail(OPENID, event) };
      case 'getDutyCheckInQrCode':
        return { success: true, data: await getDutyCheckInQrCode(OPENID, event) };
      case 'getDutyCheckInPageData':
        return { success: true, data: await getDutyCheckInPageData(OPENID, event) };
      case 'updateDutyCheckInStatus':
        return { success: true, data: await updateDutyCheckInStatus(OPENID, event) };
      case 'exportDutyCheckInReport':
        return { success: true, data: await exportDutyCheckInReport(OPENID, event) };
      case 'createAppointment':
        return { success: true, data: await createAppointment(OPENID, event) };
      case 'cancelAppointment':
        return { success: true, data: await cancelAppointment(OPENID, event) };
      case 'adminUpdateAppointmentStatus':
        return { success: true, data: await adminUpdateAppointmentStatus(OPENID, event) };
      case 'submitStaffRequest':
      case 'bindStaff':
        return { success: true, data: await submitStaffRequest(OPENID, event) };
      case 'reviewStaffRequest':
        return { success: true, data: await reviewStaffRequest(OPENID, event) };
      case 'updateStaffBindingCode':
        return { success: true, data: await updateStaffBindingCode(OPENID, event) };
      case 'updateStaffGroup':
        return { success: true, data: await updateStaffGroup(OPENID, event) };
      case 'batchUpdateStaffGroup':
        return { success: true, data: await batchUpdateStaffGroup(OPENID, event) };
      case 'removeStaffBinding':
        return { success: true, data: await removeStaffBinding(OPENID, event) };
      case 'completeAppointment':
        return { success: true, data: await completeAppointment(OPENID, event) };
      case 'updateSemesterConfig':
        return { success: true, data: await updateSemesterConfig(OPENID, event) };
      case 'updateDateAvailability':
        return { success: true, data: await updateDateAvailability(OPENID, event) };
      case 'submitDutyCheckIn':
        return { success: true, data: await submitDutyCheckIn(OPENID, event) };
      default:
        return { success: false, message: '不支持的操作' };
    }
  } catch (error) {
    return { success: false, message: error.message || '服务异常' };
  }
};
