const service = require('../../../utils/service');

function decorateStaffMembers(staffMembers = [], selectedOpenIds = []) {
  const selectedSet = new Set(selectedOpenIds);
  return staffMembers.map((item) => ({
    ...item,
    selected: selectedSet.has(item.openId)
  }));
}

function filterStaffMembers(staffMembers = [], keyword = '', groupId = 0) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  const normalizedGroupId = Number(groupId) || 0;
  return staffMembers.filter((item) => {
    if (normalizedGroupId && Number(item.groupId || 0) !== normalizedGroupId) {
      return false;
    }
    if (!normalizedKeyword) {
      return true;
    }
    const staffName = String(item.staffName || '').toLowerCase();
    const openId = String(item.openId || '').toLowerCase();
    return staffName.includes(normalizedKeyword) || openId.includes(normalizedKeyword);
  });
}

function getVisibleSelectionSummary(staffMembers = []) {
  const visibleSelectedCount = staffMembers.filter((item) => item.selected).length;
  return {
    visibleSelectedCount,
    allVisibleSelected: staffMembers.length > 0 && visibleSelectedCount === staffMembers.length
  };
}

Page({
  data: {
    loading: true,
    updatingStaffKey: '',
    batchUpdating: false,
    searchKeyword: '',
    selectedGroupId: 0,
    visibleSelectedCount: 0,
    allVisibleSelected: false,
    groupOptions: [],
    allStaffMembers: [],
    staffMembers: [],
    selectedOpenIds: []
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
  },

  applyFilters(allStaffMembers = this.data.allStaffMembers, extraData = {}) {
    const searchKeyword = Object.prototype.hasOwnProperty.call(extraData, 'searchKeyword')
      ? extraData.searchKeyword
      : this.data.searchKeyword;
    const selectedGroupId = Object.prototype.hasOwnProperty.call(extraData, 'selectedGroupId')
      ? extraData.selectedGroupId
      : this.data.selectedGroupId;
    const staffMembers = filterStaffMembers(allStaffMembers, searchKeyword, selectedGroupId);

    this.setData({
      ...extraData,
      allStaffMembers,
      staffMembers,
      ...getVisibleSelectionSummary(staffMembers)
    });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const data = await service.getStaffGroupAdminData();
      const validSelectedOpenIds = this.data.selectedOpenIds.filter((openId) => (data.staffMembers || []).some((item) => item.openId === openId));
      const allStaffMembers = decorateStaffMembers(data.staffMembers, validSelectedOpenIds);
      this.setData({
        loading: false,
        groupOptions: data.groupOptions,
        selectedOpenIds: validSelectedOpenIds
      });
      this.applyFilters(allStaffMembers);
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
    const allStaffMembers = this.data.allStaffMembers.map((item) => ({
      ...item,
      selected: selectedOpenIds.includes(item.openId)
    }));
    this.setData({
      selectedOpenIds
    });
    this.applyFilters(allStaffMembers);
  },

  updateSearchKeyword(e) {
    const searchKeyword = e.detail.value || '';
    this.applyFilters(this.data.allStaffMembers, { searchKeyword });
  },

  clearSearchKeyword() {
    if (!this.data.searchKeyword) {
      return;
    }
    this.applyFilters(this.data.allStaffMembers, { searchKeyword: '' });
  },

  selectGroupFilter(e) {
    const selectedGroupId = Number(e.currentTarget.dataset.groupId) || 0;
    if (selectedGroupId === this.data.selectedGroupId) {
      return;
    }
    this.applyFilters(this.data.allStaffMembers, { selectedGroupId });
  },

  handleSelectionChange(e) {
    if (this.data.batchUpdating || this.data.updatingStaffKey) {
      return;
    }
    const visibleOpenIds = this.data.staffMembers.map((item) => item.openId);
    const visibleSelectedOpenIds = e.detail.value || [];
    const selectedSet = new Set(this.data.selectedOpenIds.filter((openId) => !visibleOpenIds.includes(openId)));
    visibleSelectedOpenIds.forEach((openId) => selectedSet.add(openId));
    this.setSelectedOpenIds(Array.from(selectedSet));
  },

  toggleSelectAll() {
    if (this.data.batchUpdating || this.data.updatingStaffKey) {
      return;
    }
    const visibleOpenIds = this.data.staffMembers.map((item) => item.openId);
    if (!visibleOpenIds.length) {
      return;
    }
    const allVisibleSelected = visibleOpenIds.every((openId) => this.data.selectedOpenIds.includes(openId));
    if (allVisibleSelected) {
      this.setSelectedOpenIds(this.data.selectedOpenIds.filter((openId) => !visibleOpenIds.includes(openId)));
      return;
    }
    this.setSelectedOpenIds(Array.from(new Set(this.data.selectedOpenIds.concat(visibleOpenIds))));
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
