const service = require('../../../utils/service');

function hasDutyStarted(serviceDate) {
  if (!serviceDate) {
    return false;
  }
  const [year, month, day] = String(serviceDate).split('-').map((item) => Number(item));
  const dutyStartTime = new Date(year, month - 1, day, 19, 0, 0);
  return Date.now() >= dutyStartTime.getTime();
}

function buildDisplayFields(item, matchedOverview) {
  const dutyAlreadyStarted = item.dutyStarted && hasDutyStarted(item.serviceDate);

  if (!item.dutyStarted) {
    return {
      dutyText: '未安排值班',
      description: `第${item.weekNo}周 · 未安排值班`,
      summaryText: '未安排值班',
      canManageBooking: false,
      manageButtonText: '当前不可设置'
    };
  }

  if (dutyAlreadyStarted) {
    return {
      dutyText: '已值班',
      description: `第${item.weekNo}周 · ${item.groupName}已值班`,
      summaryText: '已值班',
      canManageBooking: false,
      manageButtonText: '当前不可设置'
    };
  }

  return {
    dutyText: `${item.groupName}值班`,
    description: matchedOverview && matchedOverview.isManuallyClosed
      ? `第${item.weekNo}周 · ${item.groupName}值班（已关闭预约）`
      : `第${item.weekNo}周 · ${item.groupName}值班`,
    summaryText: matchedOverview ? matchedOverview.summaryText : '当前不可设置',
    canManageBooking: Boolean(matchedOverview),
    manageButtonText: matchedOverview
      ? (matchedOverview.isManuallyClosed ? '开启当日预约' : '关闭当日预约')
      : '当前不可设置'
  };
}

function mergeDutyItems(preview = [], overview = []) {
  const overviewMap = new Map((overview || []).map((item) => [item.serviceDate, item]));

  const mergedPreview = (preview || []).map((item) => {
    const matched = overviewMap.get(item.serviceDate);
    if (matched) {
      overviewMap.delete(item.serviceDate);
    }
    return {
      ...item,
      isManuallyClosed: matched ? matched.isManuallyClosed : false,
      ...buildDisplayFields(item, matched)
    };
  });

  const extraOverview = Array.from(overviewMap.values()).map((item) => ({
    ...item,
    weekLabel: `第${item.weekNo}周`,
    isManuallyClosed: item.isManuallyClosed,
    ...buildDisplayFields(item, item)
  }));

  return mergedPreview.concat(extraOverview);
}

Page({
  data: {
    loading: true,
    savingSemester: false,
    updatingDateKey: '',
    semesterDutyItems: [],
    semesterForm: {
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
      const data = await service.getAdminData();
      const semesterDutyItems = mergeDutyItems(data.semesterDutyPreview || [], data.scheduleOverview || []);
      this.setData({
        loading: false,
        semesterDutyItems,
        semesterForm: {
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

  changeSemesterDate(e) {
    this.setData({ 'semesterForm.semesterStartDate': e.detail.value });
  },

  updateDutyStartWeek(e) {
    this.setData({ 'semesterForm.dutyStartWeek': e.detail.value });
  },

  async saveSemesterConfig() {
    if (this.data.savingSemester) {
      return;
    }
    this.setData({ savingSemester: true });
    try {
      await service.updateSemesterConfig({
        semesterStartDate: this.data.semesterForm.semesterStartDate,
        dutyStartWeek: Number(this.data.semesterForm.dutyStartWeek)
      });
      wx.showToast({ title: '学期配置已保存', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingSemester: false });
    }
  },

  async toggleDateAvailability(e) {
    const { serviceDate, closed } = e.currentTarget.dataset;
    if (!serviceDate || this.data.updatingDateKey) {
      return;
    }
    this.setData({ updatingDateKey: serviceDate });
    try {
      await service.updateDateAvailability({
        serviceDate,
        isOpen: Boolean(closed)
      });
      wx.showToast({ title: closed ? '已开启预约' : '已关闭预约', icon: 'success' });
      await this.loadData();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ updatingDateKey: '' });
    }
  }
});
