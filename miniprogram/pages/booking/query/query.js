const service = require('../../../utils/service');
const SLOT_ORDER = { slot1: 1, slot2: 2 };

function parseDateParts(serviceDate = '') {
  const [year, month, day] = String(serviceDate).split('-').map((item) => Number(item));
  return { year, month, day };
}

function toLocalDate(serviceDate = '') {
  const { year, month, day } = parseDateParts(serviceDate);
  return new Date(year, month - 1, day, 0, 0, 0);
}

function getCurrentWeekRange(now = new Date()) {
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const weekday = currentDate.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = new Date(currentDate.getTime());
  weekStart.setDate(currentDate.getDate() + offset);
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekStart.getDate() + 7);
  return { weekStart, weekEnd };
}

function isInCurrentWeek(serviceDate = '', now = new Date()) {
  const targetDate = toLocalDate(serviceDate);
  const { weekStart, weekEnd } = getCurrentWeekRange(now);
  return targetDate >= weekStart && targetDate < weekEnd;
}

function getSlotOrder(slotId = '') {
  return SLOT_ORDER[slotId] || 99;
}

function compareByServiceTimeAsc(a, b) {
  if (a.serviceDate !== b.serviceDate) {
    return a.serviceDate > b.serviceDate ? 1 : -1;
  }
  return getSlotOrder(a.slotId) - getSlotOrder(b.slotId);
}

function compareByServiceTimeDesc(a, b) {
  return compareByServiceTimeAsc(b, a);
}

function sortAllAppointmentsForDisplay(appointments = []) {
  const upcomingAppointments = appointments
    .filter((item) => item.status === 'booked')
    .slice()
    .sort(compareByServiceTimeAsc);
  const historyAppointments = appointments
    .filter((item) => item.status !== 'booked')
    .slice()
    .sort(compareByServiceTimeDesc);
  return upcomingAppointments.concat(historyAppointments);
}

Page({
  data: {
    loading: true,
    cancelingId: '',
    myAppointments: [],
    weeklyAppointments: [],
    historyAppointments: [],
    queryResults: [],
    historyDateOptions: [],
    selectedHistoryDate: '',
    selectedHistoryDateLabel: '',
    historyQueryMode: 'none',
    historyEmptyText: '未查询到对应预约'
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
      const data = await service.getBookingQueryData();
      const myAppointments = (data.myAppointments || []).filter((item) => item.status === 'booked' || item.status === 'completed');
      const weeklyAppointments = myAppointments.filter((item) => isInCurrentWeek(item.serviceDate));
      const historyAppointments = myAppointments.filter((item) => !isInCurrentWeek(item.serviceDate));
      const historyDateOptions = (data.dutyDateOptions || []).slice().sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : -1));
      this.setData({
        loading: false,
        myAppointments,
        weeklyAppointments,
        historyAppointments,
        historyDateOptions,
        selectedHistoryDate: '',
        selectedHistoryDateLabel: '',
        queryResults: [],
        historyQueryMode: 'none',
        historyEmptyText: '未查询到对应预约'
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  chooseHistoryDate(e) {
    const index = Number(e.detail.value);
    const selectedOption = this.data.historyDateOptions[index];
    this.setData({
      selectedHistoryDate: selectedOption ? selectedOption.serviceDate : '',
      selectedHistoryDateLabel: selectedOption ? selectedOption.serviceDateLabel : ''
    });
  },

  queryBySelectedDate() {
    if (!this.data.selectedHistoryDate) {
      wx.showToast({ title: '请先选择值班日期', icon: 'none' });
      return;
    }

    const queryResults = this.data.myAppointments.filter((item) => item.serviceDate === this.data.selectedHistoryDate);
    this.setData({
      queryResults,
      historyQueryMode: 'byDate',
      historyEmptyText: '该值班未预约'
    });
  },

  queryAllHistory() {
    this.setData({
      queryResults: sortAllAppointmentsForDisplay(this.data.myAppointments),
      historyQueryMode: 'all',
      historyEmptyText: '暂无预约记录'
    });
  },

  async cancelAppointment(e) {
    const appointmentId = e.currentTarget.dataset.id;
    const rawCanCancel = e.currentTarget.dataset.canCancel;
    const canCancel = !(rawCanCancel === false || rawCanCancel === 'false' || rawCanCancel === 0 || rawCanCancel === '0');
    if (!appointmentId || this.data.cancelingId) {
      return;
    }

    if (!canCancel) {
      await new Promise((resolve) => {
        wx.showModal({
          title: '不可取消',
          content: '预约日期当天不可取消预约',
          showCancel: false,
          success: () => resolve(),
          fail: () => resolve()
        });
      });
      return;
    }

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消预约',
        content: '确认取消这条预约吗？预约日期当天将不可取消。',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });

    if (!confirm) {
      return;
    }

    this.setData({ cancelingId: appointmentId });
    try {
      await service.cancelAppointment({ appointmentId });
      wx.showToast({ title: '已取消预约', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '取消失败', icon: 'none' });
    } finally {
      this.setData({ cancelingId: '' });
    }
  }
});
