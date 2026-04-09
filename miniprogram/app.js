const { CLOUD_ENV } = require('./utils/config');

App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '当前微信基础库版本过低，无法使用云开发能力。',
        showCancel: false
      });
      return;
    }

    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true
    });
  }
});
