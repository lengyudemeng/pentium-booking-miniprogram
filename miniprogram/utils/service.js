const { CLOUD_ENV } = require('./config');

function ensureCloudEnv() {
  if (!CLOUD_ENV || CLOUD_ENV.indexOf('replace-with-your-cloud-env-id') > -1) {
    throw new Error('请先在 miniprogram/utils/config.js 中配置云开发环境 ID');
  }
}

function callService(action, data = {}) {
  ensureCloudEnv();
  return wx.cloud.callFunction({
    name: 'bookingService',
    data: {
      action,
      ...data
    }
  }).then((res) => {
    const result = res.result || {};
    if (!result.success) {
      throw new Error(result.message || '请求失败');
    }
    return result.data;
  });
}

module.exports = {
  getOpenId(payload) {
    return callService('getOpenId', payload);
  },
  getAppData(payload) {
    return callService('getAppData', payload);
  },
  getAdminData(payload) {
    return callService('getAdminData', payload);
  },
  createAppointment(payload) {
    return callService('createAppointment', payload);
  },
  cancelAppointment(payload) {
    return callService('cancelAppointment', payload);
  },
  submitStaffRequest(payload) {
    return callService('submitStaffRequest', payload);
  },
  reviewStaffRequest(payload) {
    return callService('reviewStaffRequest', payload);
  },
  updateStaffBindingCode(payload) {
    return callService('updateStaffBindingCode', payload);
  },
  updateStaffGroup(payload) {
    return callService('updateStaffGroup', payload);
  },
  batchUpdateStaffGroup(payload) {
    return callService('batchUpdateStaffGroup', payload);
  },
  removeStaffBinding(payload) {
    return callService('removeStaffBinding', payload);
  },
  completeAppointment(payload) {
    return callService('completeAppointment', payload);
  },
  updateSemesterConfig(payload) {
    return callService('updateSemesterConfig', payload);
  },
  updateDateAvailability(payload) {
    return callService('updateDateAvailability', payload);
  },
  getDutyCheckInAdminData(payload) {
    return callService('getDutyCheckInAdminData', payload);
  },
  getDutyCheckInPageData(payload) {
    return callService('getDutyCheckInPageData', payload);
  },
  submitDutyCheckIn(payload) {
    return callService('submitDutyCheckIn', payload);
  },
  updateDutyCheckInStatus(payload) {
    return callService('updateDutyCheckInStatus', payload);
  },
  exportDutyCheckInReport(payload) {
    return callService('exportDutyCheckInReport', payload);
  }
};
