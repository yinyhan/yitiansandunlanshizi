// components/image-picker/index.js
const { pickImage, pickImages, ensureAuth, deleteLocalImage } = require('../../utils/image.js');

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false
  },

  properties: {
    value: {
      type: null,         // 兼容 array 和 string
      value: null
    },
    mode: {
      type: String,
      value: 'multi'      // multi | single | avatar
    },
    max: {
      type: Number,
      value: 9
    },
    cover: {
      type: String,
      value: ''           // 封面图 URL（多图模式下高亮）
    },
    crop: {
      type: Boolean,
      value: false        // 是否在选择后裁剪
    },
    cropRatio: {
      type: String,
      value: '1:1'        // 裁剪比例
    }
  },

  methods: {
    onAdd() {
      this._doPick();
    },

    onPreview(e) {
      const idx = e.currentTarget.dataset.index;
      const urls = this.data.value || [];
      wx.previewImage({
        current: urls[idx],
        urls: urls
      });
    },

    onPreviewSingle() {
      if (this.data.value) {
        wx.previewImage({
          current: this.data.value,
          urls: [this.data.value]
        });
      }
    },

    onLongPress(e) {
      // 长按图片：弹操作菜单（设为封面 / 删除）
      const idx = e.currentTarget.dataset.index;
      const url = this.data.value[idx];
      wx.showActionSheet({
        itemList: url === this.data.cover ? ['取消封面', '删除'] : ['设为封面', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this._emit(url === this.data.cover ? null : url);
          } else if (res.tapIndex === 1) {
            this._removeAt(idx);
          }
        }
      });
    },

    onDelete(e) {
      e.stopPropagation && e.stopPropagation();
      const idx = e.currentTarget.dataset.index;
      wx.showModal({
        title: '删除图片',
        content: '确定删除这张图片？',
        success: (r) => {
          if (r.confirm) this._removeAt(idx);
        }
      });
    },

    onDeleteSingle() {
      wx.showModal({
        title: '删除图片',
        content: '确定删除这张图片？',
        success: (r) => {
          if (r.confirm) this._emit(null);
        }
      });
    },

    _removeAt(idx) {
      const list = (this.data.value || []).slice();
      const removed = list.splice(idx, 1)[0];
      // 异步删除本地文件
      if (removed) deleteLocalImage(removed);
      this._emit(list);
    },

    _doPick() {
      const mode = this.data.mode;
      const crop = this.data.crop;
      const ratio = this.data.cropRatio;
      const max = this.data.max;

      if (mode === 'avatar' || mode === 'single') {
        // 单张：弹选择框（拍照/相册）
        wx.showActionSheet({
          itemList: ['拍照', '从相册选'],
          success: async (res) => {
            const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
            try {
              // 关键修复：某些 iOS 客户端 chooseMedia 不会自动弹权限，必须先主动申请
              await ensureAuth(sourceType);
              const path = await pickImage({ crop, cropRatio: ratio, sourceType });
              if (path) this._emit(path);
            } catch (e) {
              console.error('[image-picker] pick 失败', e);
              // 区分错误类型给用户不同提示
              const msg = (e.message || '').toLowerCase();
              if (msg.includes('camera') || msg.includes('authorize')) {
                wx.showToast({ title: '请授权相机权限', icon: 'none', duration: 2000 });
              } else {
                wx.showToast({ title: '选择失败', icon: 'none' });
              }
            }
          }
        });
      } else {
        // 多张：直接选
        const remain = max - (this.data.value || []).length;
        if (remain <= 0) {
          wx.showToast({ title: `最多 ${max} 张`, icon: 'none' });
          return;
        }
        wx.showActionSheet({
          itemList: ['拍照', '从相册选'],
          success: async (res) => {
            const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
            try {
              // 关键修复：某些 iOS 客户端 chooseMedia 不会自动弹权限，必须先主动申请
              await ensureAuth(sourceType);
              const paths = await pickImages({ count: remain, crop, cropRatio: ratio, sourceType });
              const newList = (this.data.value || []).concat(paths);
              this._emit(newList);
            } catch (e) {
              console.error('[image-picker] pick 失败', e);
              const msg = (e.message || '').toLowerCase();
              if (msg.includes('camera') || msg.includes('authorize')) {
                wx.showToast({ title: '请授权相机权限', icon: 'none', duration: 2000 });
              } else {
                wx.showToast({ title: '选择失败', icon: 'none' });
              }
            }
          }
        });
      }
    },

    _emit(value) {
      // 触发 change 事件，detail.value
      this.triggerEvent('change', { value });
    }
  }
});
