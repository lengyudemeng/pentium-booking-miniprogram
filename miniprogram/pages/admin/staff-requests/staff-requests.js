const service = require('../../../utils/service');

function generateRandomBindingCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

Page({
  data: {
    loading: true,
    savingBindingCode: false,
    reviewingKey: '',
    showBindingCodePlain: false,
    groupOptions: [],
    staffRequests: [],
    bindingCodeForm: {
      staffBindingCode: ''
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
      const data = await service.getStaffRequestAdminData();
      this.setData({
        loading: false,
        groupOptions: data.groupOptions,
        staffRequests: data.staffRequests,
        'bindingCodeForm.staffBindingCode': data.staffBindingCode || ''
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

  updateBindingCode(e) {
    this.setData({
      'bindingCodeForm.staffBindingCode': e.detail.value
    });
  },

  toggleBindingCodePlain() {
    this.setData({
      showBindingCodePlain: !this.data.showBindingCodePlain
    });
  },

  fillRandomBindingCode() {
    this.setData({
      'bindingCodeForm.staffBindingCode': generateRandomBindingCode()
    });
  },

  async saveBindingCode() {
    if (this.data.savingBindingCode) {
      return;
    }
    this.setData({ savingBindingCode: true });
    try {
      await service.updateStaffBindingCode({
        staffBindingCode: this.data.bindingCodeForm.staffBindingCode
      });
      wx.showToast({ title: '绑定码已保存', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingBindingCode: false });
    }
  },

  async reviewRequest(e) {
    const { openid, action, groupId } = e.currentTarget.dataset;
    if (!openid || this.data.reviewingKey) {
      return;
    }
    this.setData({ reviewingKey: `${openid}-${action}-${groupId || 0}` });
    try {
      await service.reviewStaffRequest({
        targetOpenId: openid,
        reviewAction: action,
        groupId: Number(groupId)
      });
      wx.showToast({ title: action === 'approve' ? '已批准' : '已驳回', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ reviewingKey: '' });
    }
  }
});
