const DEFAULT_SHARE_TITLE = '奔腾特勤队预约服务';
const DEFAULT_SHARE_PATH = '/pages/index/index';
const DEFAULT_SHARE_IMAGE_URL = '/assets/banner.png';

function enableShareMenu() {
  if (typeof wx === 'undefined' || !wx.showShareMenu) {
    return;
  }

  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
}

function getShareAppMessageConfig(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE_TITLE,
    path: options.path || DEFAULT_SHARE_PATH,
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE_URL
  };
}

function getShareTimelineConfig(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE_TITLE,
    query: options.query || '',
    imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE_URL
  };
}

module.exports = {
  enableShareMenu,
  getShareAppMessageConfig,
  getShareTimelineConfig
};
