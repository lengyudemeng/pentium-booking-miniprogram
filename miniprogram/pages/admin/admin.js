const service = require('../../utils/service');

Page({
  data: {
    loading: true,
    staffRequestCount: 0,
    staffMemberCount: 0,
    semesterConfig: {
      semesterStartDate: '',
      dutyStartWeek: 1
    }
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
      const data = await service.getAdminDashboardData();
      this.setData({
        loading: false,
        staffRequestCount: data.staffRequestCount || 0,
        staffMemberCount: data.staffMemberCount || 0,
        semesterConfig: {
          semesterStartDate: data.semesterConfig.semesterStartDate,
          dutyStartWeek: data.semesterConfig.dutyStartWeek
        }
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      if ((error.message || '').indexOf('管理员') > -1) {
        setTimeout(() => wx.navigateBack({ delta: 1 }), 1200);
      }
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  goStaffRequests() {
    wx.navigateTo({
      url: '/pages/admin/staff-requests/staff-requests'
    });
  },

  goStaffGroups() {
    wx.navigateTo({
      url: '/pages/admin/staff-groups/staff-groups'
    });
  },

  goBookingQuery() {
    wx.navigateTo({
      url: '/pages/admin/booking-query/booking-query'
    });
  },

  goSemesterConfig() {
    wx.navigateTo({
      url: '/pages/admin/semester-config/semester-config'
    });
  },

  goDutyCheckin() {
    wx.navigateTo({
      url: '/pages/admin/duty-checkin/duty-checkin'
    });
  }
});
