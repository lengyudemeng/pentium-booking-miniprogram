const service = require('../../utils/service');

function parseServiceDateFromScene(scene = '') {
  const decoded = decodeURIComponent(scene || '');
  const match = decoded.match(/(?:^|&)d=([^&]+)/);
  return match ? match[1] : '';
}

Page({
  data: {
    loading: true,
    submitting: false,
    autoSubmitting: false,
    serviceDate: '',
    checkInInfo: null
  },

  onLoad(options = {}) {
    const serviceDate = options.serviceDate || parseServiceDateFromScene(options.scene);
    this.setData({ serviceDate });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
  },

  async loadData() {
    if (!this.data.serviceDate) {
      this.setData({ loading: false, checkInInfo: null });
      wx.stopPullDownRefresh();
      return;
    }

    this.setData({ loading: true });
    try {
      const checkInInfo = await service.getDutyCheckInPageData({
        serviceDate: this.data.serviceDate
      });
      this.setData({
        loading: false,
        checkInInfo
      });

      if (checkInInfo && checkInInfo.canCheckIn && !checkInInfo.signed && !this.data.autoSubmitting) {
        await this.submitCheckIn(true);
      }
    } catch (error) {
      this.setData({ loading: false, checkInInfo: null });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async submitCheckIn(isAuto = false) {
    if (this.data.submitting || !this.data.checkInInfo || !this.data.checkInInfo.canCheckIn) {
      return;
    }
    this.setData({
      submitting: true,
      autoSubmitting: isAuto
    });
    try {
      await service.submitDutyCheckIn({
        serviceDate: this.data.serviceDate
      });
      if (!isAuto) {
        wx.showToast({ title: '签到成功', icon: 'success' });
      }
      const checkInInfo = await service.getDutyCheckInPageData({
        serviceDate: this.data.serviceDate
      });
      this.setData({
        checkInInfo
      });
      if (isAuto) {
        wx.showToast({ title: '已自动签到', icon: 'success' });
      }
    } catch (error) {
      wx.showToast({ title: error.message || '签到失败', icon: 'none' });
    } finally {
      this.setData({
        submitting: false,
        autoSubmitting: false,
        loading: false
      });
    }
  }
});
