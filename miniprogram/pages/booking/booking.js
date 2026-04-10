Page({
  goCreatePage() {
    wx.navigateTo({
      url: '/pages/booking/create/create'
    });
  },

  goQueryPage() {
    wx.navigateTo({
      url: '/pages/booking/query/query'
    });
  }
});
