const service = require('../../../utils/service');

function decorateStaffMembers(staffMembers = [], selectedOpenIds = []) {
  const selectedSet = new Set(selectedOpenIds);
  return staffMembers.map((item) => ({
    ...item,
    selected: selectedSet.has(item.openId)
  }));
}

Page({
  data: {
    loading: true,
    updatingStaffKey: '',
    batchUpdating: false,
    groupOptions: [],
    staffMembers: [],
    selectedOpenIds: []
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
      const data = await service.getAdminData();
      const validSelectedOpenIds = this.data.selectedOpenIds.filter((openId) => (data.staffMembers || []).some((item) => item.openId === openId));
      this.setData({
        loading: false,
        groupOptions: data.groupOptions,
        selectedOpenIds: validSelectedOpenIds,
        staffMembers: decorateStaffMembers(data.staffMembers, validSelectedOpenIds)
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

  setSelectedOpenIds(selectedOpenIds = []) {
    this.setData({
      selectedOpenIds,
      staffMembers: this.data.staffMembers.map((item) => ({
        ...item,
        selected: selectedOpenIds.includes(item.openId)
      }))
    });
  },

  handleSelectionChange(e) {
    if (this.data.batchUpdating || this.data.updatingStaffKey) {
      return;
    }
    this.setSelectedOpenIds(e.detail.value || []);
  },

  toggleSelectAll() {
    if (this.data.batchUpdating || this.data.updatingStaffKey) {
      return;
    }
    if (this.data.selectedOpenIds.length === this.data.staffMembers.length) {
      this.setSelectedOpenIds([]);
      return;
    }
    this.setSelectedOpenIds(this.data.staffMembers.map((item) => item.openId));
  },

  async batchUpdateStaffGroup(e) {
    const { groupId } = e.currentTarget.dataset;
    const selectedOpenIds = this.data.selectedOpenIds || [];
    if (!groupId || !selectedOpenIds.length || this.data.batchUpdating || this.data.updatingStaffKey) {
      return;
    }

    this.setData({ batchUpdating: true });
    try {
      await service.batchUpdateStaffGroup({
        targetOpenIds: selectedOpenIds,
        groupId: Number(groupId)
      });
      wx.showToast({ title: '批量分组已更新', icon: 'success' });
      this.setSelectedOpenIds([]);
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '批量更新失败', icon: 'none' });
    } finally {
      this.setData({ batchUpdating: false });
    }
  },

  async updateStaffGroup(e) {
    const { openid, groupId } = e.currentTarget.dataset;
    if (!openid || !groupId || this.data.updatingStaffKey || this.data.batchUpdating) {
      return;
    }
    this.setData({ updatingStaffKey: `${openid}-${groupId}` });
    try {
      await service.updateStaffGroup({
        targetOpenId: openid,
        groupId: Number(groupId)
      });
      wx.showToast({ title: '分组已更新', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '更新失败', icon: 'none' });
    } finally {
      this.setData({ updatingStaffKey: '' });
    }
  },

  async removeStaffBinding(e) {
    const { openid, staffName } = e.currentTarget.dataset;
    if (!openid || this.data.updatingStaffKey || this.data.batchUpdating) {
      return;
    }

    const modalRes = await wx.showModal({
      title: '取消服务人员绑定',
      content: `确认取消${staffName || '该成员'}的服务人员绑定吗？取消后该成员将不再拥有服务人员权限。`,
      confirmColor: '#ef4444'
    });

    if (!modalRes.confirm) {
      return;
    }

    this.setData({ updatingStaffKey: `${openid}-remove` });
    try {
      await service.removeStaffBinding({
        targetOpenId: openid
      });
      wx.showToast({ title: '已取消绑定', icon: 'success' });
      this.setSelectedOpenIds(this.data.selectedOpenIds.filter((item) => item !== openid));
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ updatingStaffKey: '' });
    }
  }
});
