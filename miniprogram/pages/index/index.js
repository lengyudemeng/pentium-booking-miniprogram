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
      const data = await service.getHomeData();
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

  goCreateBooking() {
    wx.navigateTo({
      url: '/pages/booking/create/create'
    });
  },

  goQueryBooking() {
    wx.navigateTo({
      url: '/pages/booking/query/query'
    });
  },

  goBooking() {
    wx.navigateTo({
      url: '/pages/booking/create/create'
    });
  }
});
