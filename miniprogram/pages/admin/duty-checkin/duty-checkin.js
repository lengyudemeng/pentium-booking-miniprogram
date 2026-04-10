const service = require('../../../utils/service');
const MEMBER_BATCH_SIZE = 8;

Page({
  data: {
    loading: true,
    detailLoading: false,
    exporting: false,
    updatingMemberKey: '',
    qrLoading: false,
    selectedDate: '',
    dutyDates: [],
    selectedDutyDate: null,
    signedMembers: [],
    unsignedMembers: [],
    signedRenderedCount: 0,
    unsignedRenderedCount: 0,
    signedHasMore: false,
    unsignedHasMore: false
  },

  onShow() {
    this.detailCache = this.detailCache || {};
    this.loadData(this.data.selectedDate);
  },

  onPullDownRefresh() {
    this.loadData(this.data.selectedDate);
  },

  setMemberLists(signedMembers = [], unsignedMembers = [], options = {}) {
    const signedRenderedCount = Math.min(options.signedRenderedCount || MEMBER_BATCH_SIZE, signedMembers.length);
    const unsignedRenderedCount = Math.min(options.unsignedRenderedCount || MEMBER_BATCH_SIZE, unsignedMembers.length);
    this.allSignedMembers = signedMembers;
    this.allUnsignedMembers = unsignedMembers;
    this.setData({
      signedMembers: signedMembers.slice(0, signedRenderedCount),
      unsignedMembers: unsignedMembers.slice(0, unsignedRenderedCount),
      signedRenderedCount,
      unsignedRenderedCount,
      signedHasMore: signedRenderedCount < signedMembers.length,
      unsignedHasMore: unsignedRenderedCount < unsignedMembers.length
    });
  },

  cacheDetail(detail = {}) {
    const selectedDate = detail.selectedDate;
    if (!selectedDate) {
      return;
    }
    this.detailCache = this.detailCache || {};
    this.detailCache[selectedDate] = {
      selectedDate,
      selectedDutyDate: detail.selectedDutyDate || null,
      signedMembers: detail.signedMembers || [],
      unsignedMembers: detail.unsignedMembers || []
    };
  },

  applyDetail(detail = {}, options = {}) {
    const selectedDate = detail.selectedDate || '';
    const selectedDutyDate = detail.selectedDutyDate || null;
    this.setData({
      selectedDate,
      selectedDutyDate,
      detailLoading: Boolean(options.detailLoading)
    });
    this.setMemberLists(detail.signedMembers || [], detail.unsignedMembers || []);
  },

  updateDutyDateSummary(serviceDate, signedCount, unsignedCount) {
    const dutyDates = (this.data.dutyDates || []).map((item) => {
      if (item.serviceDate !== serviceDate) {
        return item;
      }
      const totalCount = Number(item.totalCount) || (signedCount + unsignedCount);
      return {
        ...item,
        signedCount,
        unsignedCount,
        totalCount,
        signStatusText: `${signedCount}/${totalCount} 已签到`
      };
    });
    this.setData({ dutyDates });
  },

  async loadData(selectedDate = '') {
    this.setData({ loading: true });
    try {
      const data = await service.getDutyCheckInAdminData({ selectedDate });
      this.setData({
        loading: false,
        qrLoading: false,
        detailLoading: false,
        selectedDate: data.selectedDate || '',
        dutyDates: data.dutyDates || [],
        selectedDutyDate: data.selectedDutyDate || null
      });
      this.cacheDetail(data);
      this.setMemberLists(data.signedMembers || [], data.unsignedMembers || []);

      if (data.selectedDate && data.selectedDutyDate && data.selectedDutyDate.canGenerateQrCode && !data.selectedDutyDate.qrCodeFileID) {
        this.loadQrCode(data.selectedDate);
      }
    } catch (error) {
      this.setData({ loading: false, qrLoading: false });
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
    if (!serviceDate || serviceDate === this.data.selectedDate || this.data.loading || this.data.detailLoading) {
      return;
    }
    const cachedDetail = this.detailCache && this.detailCache[serviceDate];
    if (cachedDetail) {
      this.applyDetail(cachedDetail);
      if (cachedDetail.selectedDutyDate && cachedDetail.selectedDutyDate.canGenerateQrCode && !cachedDetail.selectedDutyDate.qrCodeFileID) {
        this.loadQrCode(serviceDate);
      }
      return;
    }
    this.loadDetail(serviceDate);
  },

  async loadDetail(serviceDate, options = {}) {
    if (!serviceDate) {
      return;
    }

    const matchedDutyDate = (this.data.dutyDates || []).find((item) => item.serviceDate === serviceDate);
    this.setData({
      selectedDate: serviceDate,
      selectedDutyDate: matchedDutyDate || this.data.selectedDutyDate,
      detailLoading: true
    });

    try {
      const data = await service.getDutyCheckInDetail({ serviceDate });
      this.cacheDetail(data);
      this.applyDetail(data, { detailLoading: false });
      this.updateDutyDateSummary(serviceDate, (data.signedMembers || []).length, (data.unsignedMembers || []).length);
      if (data.selectedDutyDate && data.selectedDutyDate.canGenerateQrCode && !data.selectedDutyDate.qrCodeFileID) {
        this.loadQrCode(serviceDate);
      }
    } catch (error) {
      this.setData({ detailLoading: false });
      if (!options.silent) {
        wx.showToast({ title: error.message || '详情加载失败', icon: 'none' });
      }
    }
  },

  async loadQrCode(serviceDate) {
    if (!serviceDate || this.data.qrLoading) {
      return;
    }

    this.setData({ qrLoading: true });
    try {
      const result = await service.getDutyCheckInQrCode({ serviceDate });
      if (result.serviceDate !== this.data.selectedDate) {
        return;
      }
      if (!this.data.selectedDutyDate) {
        return;
      }
      this.detailCache = this.detailCache || {};
      if (this.detailCache[serviceDate] && this.detailCache[serviceDate].selectedDutyDate) {
        this.detailCache[serviceDate].selectedDutyDate.qrCodeFileID = result.qrCodeFileID;
      }
      this.setData({
        'selectedDutyDate.qrCodeFileID': result.qrCodeFileID
      });
    } catch (error) {
      if (serviceDate === this.data.selectedDate) {
        wx.showToast({ title: error.message || '二维码加载失败', icon: 'none' });
      }
    } finally {
      if (serviceDate === this.data.selectedDate) {
        this.setData({ qrLoading: false });
      }
    }
  },

  loadMoreSignedMembers() {
    if (!this.data.signedHasMore) {
      return;
    }
    this.setMemberLists(this.allSignedMembers || [], this.allUnsignedMembers || [], {
      signedRenderedCount: this.data.signedRenderedCount + MEMBER_BATCH_SIZE,
      unsignedRenderedCount: this.data.unsignedRenderedCount
    });
  },

  loadMoreUnsignedMembers() {
    if (!this.data.unsignedHasMore) {
      return;
    }
    this.setMemberLists(this.allSignedMembers || [], this.allUnsignedMembers || [], {
      signedRenderedCount: this.data.signedRenderedCount,
      unsignedRenderedCount: this.data.unsignedRenderedCount + MEMBER_BATCH_SIZE
    });
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
      await this.loadDetail(this.data.selectedDate, { silent: true });
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
