const service = require('../../../utils/service');
const legal = require('../../../utils/legal');
const share = require('../../../utils/share');

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

function getBookingContentError(form) {
  const name = normalizeBookingText(form.name);
  const request = normalizeBookingText(form.request);
  if (DISALLOWED_CONTROL_CHAR_PATTERN.test(String(form.name || '')) || DISALLOWED_CONTROL_CHAR_PATTERN.test(String(form.request || ''))) {
    return '请删除不可见特殊字符后再提交';
  }
  if (countTextLength(name) > BOOKING_NAME_MAX_LENGTH) {
    return `姓名最多 ${BOOKING_NAME_MAX_LENGTH} 个字`;
  }
  if (countTextLength(request) > BOOKING_REQUEST_MAX_LENGTH) {
    return `预约需求最多 ${BOOKING_REQUEST_MAX_LENGTH} 个字`;
  }
  if (hasBlockedBookingContent(name) || hasBlockedBookingContent(request)) {
    return '姓名或需求包含不适宜提交的内容';
  }
  return '';
}

Page({
  data: {
    loading: true,
    submitting: false,
    cancelingId: '',
    appointmentTypes: ['清灰换硅脂', '系统异常', '台式机组装', '电脑购买咨询'],
    selectedDate: '',
    selectedDateLabel: '',
    dateOptions: [],
    slots: [],
    slotOptionsByDate: [],
    form: {
      serviceDate: '',
      slotId: '',
      appointmentType: '',
      name: '',
      phone: '',
      request: ''
    },
    agreements: {
      privacyConsent: false,
      agreementConsent: false
    },
    myAppointments: [],
    legal,
    firstBookingConsentPassed: false,
    consentPopupVisible: false,
    consentStep: 'privacy',
    consentReadState: {
      privacy: false,
      agreement: false
    }
  },

  onLoad() {
    const cached = wx.getStorageSync('bookingDraft') || {};
    const savedAgreements = wx.getStorageSync('bookingAgreements') || {};
    this.setData({
      form: {
        serviceDate: '',
        slotId: '',
        appointmentType: '',
        name: cached.name || '',
        phone: cached.phone || '',
        request: ''
      },
      agreements: {
        privacyConsent: Boolean(savedAgreements.privacyConsent),
        agreementConsent: Boolean(savedAgreements.agreementConsent)
      }
    });
  },

  onShow() {
    share.enableShareMenu();
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData(this.data.selectedDate);
  },

  async loadData(selectedDate) {
    this.setData({ loading: true });
    try {
      const data = await service.getBookingData({ selectedDate: selectedDate || this.data.selectedDate });
      const finalSelectedDate = data.selectedDate || '';
      const matchedSlotConfig = this.findSlotsByDate(data.slotOptionsByDate || [], finalSelectedDate);
      const nextSlots = matchedSlotConfig ? matchedSlotConfig.slots : data.slots;
      this.setData({
        loading: false,
        selectedDate: finalSelectedDate,
        selectedDateLabel: data.selectedDateLabel,
        dateOptions: data.dateOptions,
        slots: nextSlots,
        slotOptionsByDate: data.slotOptionsByDate || [],
        myAppointments: data.myAppointments || [],
        form: {
          ...this.data.form,
          serviceDate: finalSelectedDate,
          slotId: this.pickUsableSlot(nextSlots, this.data.form.slotId)
        }
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  pickUsableSlot(slots, currentSlotId) {
    const matched = slots.find((item) => item.id === currentSlotId && item.status === 'available');
    if (matched) {
      return matched.id;
    }
    const firstAvailable = slots.find((item) => item.status === 'available');
    return firstAvailable ? firstAvailable.id : '';
  },

  findSlotsByDate(slotOptionsByDate, serviceDate) {
    return (slotOptionsByDate || []).find((item) => item.serviceDate === serviceDate) || null;
  },

  async chooseDate(e) {
    const serviceDate = e.currentTarget.dataset.date;
    const isOpen = e.currentTarget.dataset.open;
    if (!serviceDate || !isOpen || serviceDate === this.data.selectedDate) {
      return;
    }
    const matchedSlotConfig = this.findSlotsByDate(this.data.slotOptionsByDate, serviceDate);
    if (!matchedSlotConfig) {
      await this.loadData(serviceDate);
      return;
    }
    const nextSlots = matchedSlotConfig.slots || [];
    this.setData({
      selectedDate: serviceDate,
      selectedDateLabel: matchedSlotConfig.serviceDateLabel || '',
      slots: nextSlots,
      form: {
        ...this.data.form,
        serviceDate,
        slotId: this.pickUsableSlot(nextSlots, this.data.form.slotId)
      }
    });
  },

  chooseSlot(e) {
    const { slotId, status } = e.currentTarget.dataset;
    if (status !== 'available') {
      return;
    }
    this.setData({ 'form.slotId': slotId });
  },

  updateName(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  updatePhone(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  chooseAppointmentType(e) {
    const index = Number(e.detail.value);
    const appointmentType = this.data.appointmentTypes[index] || '';
    this.setData({ 'form.appointmentType': appointmentType });
  },

  updateRequest(e) {
    this.setData({ 'form.request': e.detail.value });
  },

  togglePrivacyConsent() {
    const value = !this.data.agreements.privacyConsent;
    this.setData({ 'agreements.privacyConsent': value });
    this.persistAgreements();
  },

  toggleAgreementConsent() {
    const value = !this.data.agreements.agreementConsent;
    this.setData({ 'agreements.agreementConsent': value });
    this.persistAgreements();
  },

  persistAgreements() {
    wx.setStorageSync('bookingAgreements', this.data.agreements);
  },

  isFirstBookingUser() {
    return this.data.myAppointments.length === 0;
  },

  openFirstBookingConsentPopup() {
    this.setData({
      consentPopupVisible: true,
      consentStep: 'privacy',
      consentReadState: {
        privacy: false,
        agreement: false
      }
    });
  },

  closeFirstBookingConsentPopup() {
    this.setData({
      consentPopupVisible: false,
      consentStep: 'privacy',
      consentReadState: {
        privacy: false,
        agreement: false
      }
    });
  },

  onPrivacyScrollToLower() {
    if (this.data.consentReadState.privacy) {
      return;
    }
    this.setData({
      'consentReadState.privacy': true
    });
  },

  onAgreementScrollToLower() {
    if (this.data.consentReadState.agreement) {
      return;
    }
    this.setData({
      'consentReadState.agreement': true
    });
  },

  goToAgreementStep() {
    if (!this.data.consentReadState.privacy) {
      wx.showToast({
        title: '请先滚动阅读完隐私政策',
        icon: 'none'
      });
      return;
    }
    this.setData({
      consentStep: 'agreement'
    });
  },

  backToPrivacyStep() {
    this.setData({
      consentStep: 'privacy'
    });
  },

  confirmFirstBookingConsent() {
    if (!this.data.consentReadState.agreement) {
      wx.showToast({
        title: '请先滚动阅读完用户协议',
        icon: 'none'
      });
      return;
    }

    this.setData({
      consentPopupVisible: false,
      firstBookingConsentPassed: true,
      agreements: {
        privacyConsent: true,
        agreementConsent: true
      }
    });
    this.persistAgreements();
    this.submitBooking();
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  openUserAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  async submitBooking() {
    if (this.data.submitting) {
      return;
    }
    if (this.isFirstBookingUser() && !this.data.firstBookingConsentPassed) {
      this.openFirstBookingConsentPopup();
      return;
    }
    if (!this.data.agreements.privacyConsent) {
      wx.showToast({ title: '请先同意隐私政策', icon: 'none' });
      return;
    }
    if (!this.data.agreements.agreementConsent) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    const contentError = getBookingContentError(this.data.form);
    if (contentError) {
      wx.showToast({ title: contentError, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const normalizedForm = {
        ...this.data.form,
        name: normalizeBookingText(this.data.form.name),
        request: normalizeBookingText(this.data.form.request)
      };
      const payload = {
        ...normalizedForm,
        serviceDate: this.data.selectedDate,
        privacyConsent: this.data.agreements.privacyConsent,
        agreementConsent: this.data.agreements.agreementConsent
      };
      await service.createAppointment(payload);
      wx.setStorageSync('bookingDraft', {
        name: payload.name,
        phone: payload.phone
      });
      this.persistAgreements();
      wx.showModal({
        title: '预约成功',
        content: '你的预约已提交，请留意预约日期与时间。',
        showCancel: false
      });
      this.setData({
        form: {
          ...this.data.form,
          request: ''
        }
      });
      await this.loadData(this.data.selectedDate);
    } catch (error) {
      wx.showToast({ title: error.message || '预约失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async cancelAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    if (!appointmentId || this.data.cancelingId) {
      return;
    }

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消预约',
        content: '确认取消这条预约吗？预约日期当天将不可取消。',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });

    if (!confirm) {
      return;
    }

    this.setData({ cancelingId: appointmentId });
    try {
      await service.cancelAppointment({ appointmentId });
      wx.showToast({ title: '已取消预约', icon: 'success' });
      await this.loadData(this.data.selectedDate);
    } catch (error) {
      wx.showToast({ title: error.message || '取消失败', icon: 'none' });
    } finally {
      this.setData({ cancelingId: '' });
    }
  },

  onShareAppMessage() {
    return share.getShareAppMessageConfig({
      title: '预约奔腾特勤队周六服务'
    });
  },

  onShareTimeline() {
    return share.getShareTimelineConfig({
      title: '预约奔腾特勤队周六服务'
    });
  }
});
