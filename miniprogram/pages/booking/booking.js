const share = require('../../utils/share');

Page({
  onShow() {
    share.enableShareMenu();
  },

  goCreatePage() {
    wx.navigateTo({
      url: '/pages/booking/create/create'
    });
  },

  goQueryPage() {
    wx.navigateTo({
      url: '/pages/booking/query/query'
    });
  },

  onShareAppMessage() {
    return share.getShareAppMessageConfig();
  },

  onShareTimeline() {
    return share.getShareTimelineConfig();
  }
});
