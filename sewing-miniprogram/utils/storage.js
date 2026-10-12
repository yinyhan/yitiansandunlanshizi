// utils/storage.js
// 通用本地存储封装，业务数据优先走这里
// 后期接后端时只需把内部实现替换为 HTTP 调用即可

const PREFIX = 'sewing_';

function key(k) {
  return PREFIX + k;
}

/** 读取 */
function get(k, defaultValue = null) {
  try {
    const v = wx.getStorageSync(key(k));
    return v === '' || v === undefined ? defaultValue : v;
  } catch (e) {
    return defaultValue;
  }
}

/** 写入 */
function set(k, v) {
  try {
    wx.setStorageSync(key(k), v);
    return true;
  } catch (e) {
    return false;
  }
}

/** 删除 */
function remove(k) {
  try {
    wx.removeStorageSync(key(k));
  } catch (e) {}
}

module.exports = { get, set, remove, key };
