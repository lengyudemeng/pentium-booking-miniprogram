const service = require('../../../utils/service');

Page({
  data: {
    loading: true,
    exporting: false,
    updatingMemberKey: '',
    selectedDate: '',
    dutyDates: [],
    selectedDutyDate: null,
    signedMembers: [],
    unsignedMembers: []
  },

  onShow() {
    this.loadData(this.data.selectedDate);
  },

  onPullDownRefresh() {
    this.loadData(this.data.selectedDate);
  },

  async loadData(selectedDate = '') {
    this.setData({ loading: true });
    try {
      const data = await service.getDutyCheckInAdminData({ selectedDate });
      this.setData({
        loading: false,
        selectedDate: data.selectedDate || '',
        dutyDates: data.dutyDates || [],
        selectedDutyDate: data.selectedDutyDate || null,
        signedMembers: data.signedMembers || [],
        unsignedMembers: data.unsignedMembers || []
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

  selectDutyDate(e) {
    const { serviceDate } = e.currentTarget.dataset;
    if (!serviceDate || serviceDate === this.data.selectedDate || this.data.loading) {
      return;
    }
    this.loadData(serviceDate);
  },

  async updateMemberStatus(e) {
    const { openid, signed } = e.currentTarget.dataset;
    if (!openid || !this.data.selectedDate || this.data.updatingMemberKey || this.data.exporting) {
      return;
    }

    this.setData({ updatingMemberKey: `${openid}-${signed ? 'signed' : 'unsigned'}` });
    try {
      await service.updateDutyCheckInStatus({
        serviceDate: this.data.selectedDate,
        targetOpenId: openid,
        signed: Boolean(signed)
      });
      wx.showToast({ title: signed ? '已设为签到' : '已取消签到', icon: 'success' });
      await this.loadData(this.data.selectedDate);
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ updatingMemberKey: '' });
    }
  },

  async exportReport() {
    if (!this.data.selectedDate || this.data.exporting || this.data.loading) {
      return;
    }

    this.setData({ exporting: true });
    try {
      const exportResult = await service.exportDutyCheckInReport({
        serviceDate: this.data.selectedDate
      });
      const tempResult = await wx.cloud.getTempFileURL({
        fileList: [exportResult.fileID]
      });
      const tempFileURL = tempResult.fileList && tempResult.fileList[0] ? tempResult.fileList[0].tempFileURL : '';
      if (!tempFileURL) {
        throw new Error('导出文件链接获取失败');
      }
      const downloadResult = await wx.downloadFile({
        url: tempFileURL
      });
      await wx.openDocument({
        filePath: downloadResult.tempFilePath,
        showMenu: true
      });
    } catch (error) {
      wx.showToast({ title: error.message || '导出失败', icon: 'none' });
    } finally {
      this.setData({ exporting: false });
    }
  }
});
