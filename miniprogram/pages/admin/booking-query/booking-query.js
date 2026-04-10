const service = require('../../../utils/service');

Page({
  data: {
    loading: true,
    actionLoadingKey: '',
    selectedDate: '',
    selectedDateLabel: '',
    dutyDateOptions: [],
    selectedDutyDate: null,
    summary: {
      totalCount: 0,
      bookedCount: 0,
      completedCount: 0
    },
    appointments: []
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
      const data = await service.getAdminBookingQueryData({ selectedDate });
      this.setData({
        loading: false,
        selectedDate: data.selectedDate || '',
        selectedDateLabel: data.selectedDutyDate ? data.selectedDutyDate.serviceDateLabel : '',
        dutyDateOptions: data.dutyDateOptions || [],
        selectedDutyDate: data.selectedDutyDate || null,
        summary: data.summary || {
          totalCount: 0,
          bookedCount: 0,
          completedCount: 0
        },
        appointments: data.appointments || []
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

  chooseDutyDate(e) {
    const index = Number(e.detail.value);
    const selectedOption = this.data.dutyDateOptions[index];
    if (!selectedOption || selectedOption.serviceDate === this.data.selectedDate) {
      return;
    }
    this.loadData(selectedOption.serviceDate);
  },

  async updateAppointmentStatus(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    if (!appointmentId || !status || this.data.actionLoadingKey) {
      return;
    }

    const actionTextMap = {
      completed: '设为已结单',
      booked: '改为待服务',
      cancelled: '取消预约'
    };
    const confirmTextMap = {
      completed: '确认将该预约设为已结单吗？',
      booked: '确认将该预约改回待服务吗？',
      cancelled: '确认取消这条预约吗？'
    };

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: actionTextMap[status] || '修改预约状态',
        content: confirmTextMap[status] || '确认执行当前操作吗？',
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      });
    });

    if (!confirmed) {
      return;
    }

    const actionLoadingKey = `${appointmentId}-${status}`;
    this.setData({ actionLoadingKey });
    try {
      await service.adminUpdateAppointmentStatus({ appointmentId, status });
      wx.showToast({ title: actionTextMap[status] || '操作成功', icon: 'success' });
      await this.loadData(this.data.selectedDate);
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actionLoadingKey: '' });
    }
  }
});
