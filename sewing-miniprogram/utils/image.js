// utils/image.js
// 图片工具：选择、压缩、保存、删除
const fs = wx.getFileSystemManager();

/**
 * 选择单张图片（拍照 / 从相册）
 * @param {Object} options
 * @param {boolean} options.crop 是否需要裁剪（默认 false）
 * @param {string} options.cropRatio 裁剪比例（'1:1' | '4:3' | '3:4' | '16:9'）
 * @param {number} options.maxSize 压缩后最大边长（默认 1080）
 * @param {string[]} options.sourceType 来源（['album'] | ['camera'] | ['album','camera']）
 * @returns {Promise<string|null>} 本地文件路径（用户取消返回 null）
 */
function pickImage(options = {}) {
  const sourceType = options.sourceType || ['album', 'camera'];
  const isCameraOnly = sourceType.length === 1 && sourceType[0] === 'camera';
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,  // 透传！修复：之前写死 ['album','camera'] 导致 sourceType 参数无效
      sizeType: ['compressed'],
      success: async (res) => {
        try {
          const tempFile = res.tempFiles[0];
          let path = tempFile.tempFilePath;
          // 压缩（> 500KB 才压缩）
          if (tempFile.size > 500 * 1024) {
            path = await compressImage(path, options.maxSize || 1080);
          }
          // 裁剪：仅在相册选 + 用户显式要求时才裁剪（拍照直接上传，避免 cropper 跨页 channel 链路翻车）
          if (options.crop && !isCameraOnly) {
            path = await cropImage(path, options.cropRatio || '1:1');
          }
          // 拍照：先把 temp 拷贝到 USER_DATA_PATH 再裁剪/保存，避免后续裁剪页跨页面读到失效临时文件
          let workingPath = path;
          if (isCameraOnly) {
            try {
              workingPath = await saveImageToLocal(path);
            } catch (e) {
              console.warn('[image] 拍照保存兜底失败', e);
            }
          }
          // 保存到本地
          const saved = await saveImageToLocal(workingPath);
          resolve(saved);
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          resolve(null);  // 用户取消
        } else {
          reject(new Error(err.errMsg || '选择图片失败'));
        }
      }
    });
  });
}

/**
 * 选择多张图片
 * @param {Object} options
 * @param {number} options.count 最多选几张（默认 9）
 * @returns {Promise<string[]>} 本地文件路径数组
 */
function pickImages(options = {}) {
  const count = options.count || 9;
  const sourceType = options.sourceType || ['album', 'camera'];
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      success: async (res) => {
        try {
          const paths = [];
          for (const f of res.tempFiles) {
            let p = f.tempFilePath;
            if (f.size > 500 * 1024) {
              p = await compressImage(p, options.maxSize || 1080);
            }
            const saved = await saveImageToLocal(p);
            paths.push(saved);
          }
          resolve(paths);
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          resolve([]);
        } else {
          reject(new Error(err.errMsg || '选择图片失败'));
        }
      }
    });
  });
}

/**
 * 主动申请相机权限（某些 iOS 客户端上 chooseMedia 不会触发权限弹窗，
 * 需要先用 wx.authorize 主动申请）
 * @param {string[]} sourceType ['camera'] | ['album']
 * @returns {Promise<boolean>} 是否已授权（未授权时返回 false，但仍然尝试）
 */
function ensureAuth(sourceType) {
  return new Promise((resolve) => {
    if (!sourceType || !sourceType.includes('camera')) {
      resolve(true);
      return;
    }
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.camera'] === true) {
          resolve(true);
        } else if (res.authSetting['scope.camera'] === false) {
          // 用户之前拒绝过，引导去设置
          wx.showModal({
            title: '需要相机权限',
            content: '请在「设置」中允许使用相机后重试',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting();
              resolve(false);
            }
          });
        } else {
          // 从未申请过，主动申请
          wx.authorize({
            scope: 'scope.camera',
            success: () => resolve(true),
            fail: (err) => {
              console.warn('[image] authorize camera 失败', err);
              resolve(true);  // 授权失败仍尝试，chooseMedia 会再弹一次
            }
          });
        }
      },
      fail: () => resolve(true)
    });
  });
}

/**
 * 压缩图片
 * @param {string} path
 * @param {number} maxSize 压缩后最大边长
 * @returns {Promise<string>}
 */
function compressImage(path, maxSize = 1080) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: path,
      quality: 80,
      compressedWidth: maxSize,
      compressedHeight: maxSize,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => {
        console.warn('[image.compressImage] 失败，使用原图', err);
        resolve(path);  // 失败用原图
      }
    });
  });
}

/**
 * 调用原生裁剪页（跳转到 pages/cropper）
 * @param {string} src
 * @param {string} ratio
 * @returns {Promise<string>} 裁剪后的本地路径
 */
function cropImage(src, ratio = '1:1') {
  return new Promise((resolve, reject) => {
    const url = `/pages/cropper/index?src=${encodeURIComponent(src)}&ratio=${encodeURIComponent(ratio)}`;
    wx.navigateTo({
      url,
      success: (navRes) => {
        const channel = navRes.eventChannel;
        channel.once('cropped', (data) => {
          if (data && data.tempPath) {
            saveImageToLocal(data.tempPath).then(resolve).catch(reject);
          } else {
            reject(new Error('用户取消裁剪'));
          }
        });
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 保存图片到本地（用户文件目录，跨次启动可用）
 * @param {string} tempPath 临时文件路径
 * @returns {Promise<string>} 保存后的永久路径
 */
function saveImageToLocal(tempPath) {
  return new Promise((resolve, reject) => {
    const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    fs.saveFile({
      tempFilePath: tempPath,
      filePath: savedPath,
      success: (res) => resolve(res.savedFilePath),
      fail: (err) => {
        console.warn('[image] saveFile 失败，尝试 copyFile', err);
        // 兜底：用 copyFile 再试一次
        fs.copyFile({
          srcPath: tempPath,
          destPath: savedPath,
          success: () => resolve(savedPath),
          fail: (err2) => {
            console.error('[image] copyFile 也失败，返回 tempPath', err2);
            resolve(tempPath);  // 不得已用临时路径
          }
        });
      }
    });
  });
}

/**
 * 删除本地图片
 * @param {string} path
 */
function deleteLocalImage(path) {
  if (!path) return;
  if (path.includes(wx.env.USER_DATA_PATH)) {
    try {
      fs.unlinkSync(path);
    } catch (e) {
      console.warn('[image.deleteLocalImage] 删除失败', e.message);
    }
  }
}

module.exports = {
  pickImage,
  pickImages,
  ensureAuth,
  compressImage,
  cropImage,
  saveImageToLocal,
  deleteLocalImage
};
