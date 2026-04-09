const service = require('../../utils/service');

Page({
  data: {
    loading: true,
    selectedDateLabel: '',
    summary: {
      totalCount: 20,
      bookedCount: 0,
      completedCount: 0,
      availableCount: 0
    },
    semesterSummary: {
      totalCount: 0,
      bookedCount: 0,
      completedCount: 0
    },
    scheduleOverview: []
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const data = await service.getAppData();
      this.setData({
        loading: false,
        selectedDateLabel: data.selectedDateLabel,
        summary: data.summary,
        semesterSummary: data.semesterSummary,
        scheduleOverview: data.scheduleOverview
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  goBooking() {
    wx.switchTab({
      url: '/pages/booking/booking'
    });
  }
});
