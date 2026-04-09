const service = require('../../utils/service');
const legal = require('../../utils/legal');

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
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData(this.data.selectedDate);
  },

  async loadData(selectedDate) {
    this.setData({ loading: true });
    try {
      const data = await service.getAppData({ selectedDate: selectedDate || this.data.selectedDate });
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
        myAppointments: data.myAppointments,
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

    this.setData({ submitting: true });
    try {
      const payload = {
        ...this.data.form,
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
  }
});
