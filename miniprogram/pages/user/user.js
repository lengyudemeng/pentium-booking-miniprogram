const service = require('../../utils/service');
const share = require('../../utils/share');

Page({
  data: {
    loading: true,
    schedulesLoading: false,
    requesting: false,
    staffProfile: {
      isStaff: false,
      isPending: false,
      isRejected: false,
      status: 'none',
      staffName: '',
      groupId: 0,
      groupName: ''
    },
    permissions: {
      isAdmin: false
    },
    groupSchedules: [],
    staffBindingCodeEnabled: false,
    requestForm: {
      staffName: '',
      bindingCode: ''
    }
  },

  onShow() {
    share.enableShareMenu();
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, schedulesLoading: false });
    try {
      const data = await service.getUserData();
      this.setData({
        loading: false,
        staffProfile: data.staffProfile,
        permissions: data.permissions || { isAdmin: false },
        groupSchedules: [],
        staffBindingCodeEnabled: Boolean(data.staffBindingCodeEnabled),
        'requestForm.staffName': data.staffProfile.staffName || ''
      });

      if (data.staffProfile && data.staffProfile.isStaff && data.staffProfile.groupId) {
        this.loadDutySchedules();
      }
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadDutySchedules() {
    if (this.data.schedulesLoading) {
      return;
    }
    this.setData({ schedulesLoading: true });
    try {
      const data = await service.getUserDutySchedules();
      this.setData({
        groupSchedules: data.groupSchedules || []
      });
    } catch (error) {
      wx.showToast({ title: error.message || '值班预约加载失败', icon: 'none' });
    } finally {
      this.setData({ schedulesLoading: false });
    }
  },

  updateRequestName(e) {
    this.setData({ 'requestForm.staffName': e.detail.value });
  },

  updateBindingCode(e) {
    this.setData({ 'requestForm.bindingCode': e.detail.value });
  },

  async submitStaffRequest() {
    if (this.data.requesting) {
      return;
    }
    this.setData({ requesting: true });
    try {
      await service.submitStaffRequest(this.data.requestForm);
      wx.showToast({ title: '申请已提交', icon: 'success' });
      this.setData({ 'requestForm.bindingCode': '' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ requesting: false });
    }
  },

  async finishAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    try {
      await service.completeAppointment({ appointmentId });
      wx.showToast({ title: '已结单', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '结单失败', icon: 'none' });
    }
  },

  goAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    });
  },

  onShareAppMessage() {
    return share.getShareAppMessageConfig();
  },

  onShareTimeline() {
    return share.getShareTimelineConfig();
  }
});
