// pages/cropper/index.js
// 原生 Canvas 图片裁剪
// 核心思路：
// - 用一个 CSS canvas 容器，把原图画到 canvas 上
// - 通过 transform: translate + scale + rotate 实现裁剪效果
// - 用户触摸时修改 transform 参数
// - 确认时，用 canvasToTempFilePath 截取裁剪框区域的像素

const { getThemeClass } = require('../../utils/theme.js');

const RATIO_MAP = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '16:9': 16 / 9
};

Page({
  data: {
    themeClass: 'theme-apricot',
    src: '',
    ratio: '1:1',
    ratios: ['1:1', '4:3', '3:4', '16:9']
  },

  onLoad(query) {
    const src = decodeURIComponent(query.src || '');
    const ratio = query.ratio || '1:1';
    this.setData({ themeClass: getThemeClass(), src, ratio });

    // 状态
    this._state = {
      imageInfo: null,   // { width, height, path }
      canvas: null,
      ctx: null,
      // 变换参数
      scale: 1,          // 缩放
      rotate: 0,         // 旋转角度（0/90/180/270）
      flipH: false,      // 水平翻转
      flipV: false,      // 垂直翻转
      offsetX: 0,        // 偏移
      offsetY: 0,
      // 触摸
      touches: [],
      lastDistance: 0,
      lastCenter: { x: 0, y: 0 }
    };
  },

  onReady() {
    this._initCanvas();
  },

  _initCanvas() {
    // 获取 canvas 节点
    const query = wx.createSelectorQuery();
    query.select('#cropperCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          console.error('[cropper] canvas not found');
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this._state.canvas = canvas;
        this._state.ctx = ctx;
        this._state.stageW = res[0].width;
        this._state.stageH = res[0].height;

        // 加载图片
        this._loadImage();
      });
  },

  _loadImage() {
    const { src, stageW, stageH } = this._state;
    const img = this._state.canvas.createImage();
    img.onload = () => {
      this._state.imageInfo = { width: img.width, height: img.height, image: img };
      this._fitToStage();
      this._draw();
    };
    img.onerror = (e) => {
      console.error('[cropper] 图片加载失败', e);
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    };
    img.src = src;
  },

  _fitToStage() {
    // 根据比例和 stage 尺寸，计算裁剪框
    const ratio = RATIO_MAP[this.data.ratio];
    const { stageW, stageH } = this._state;
    const stageRatio = stageW / stageH;
    let cropW, cropH;
    if (ratio >= stageRatio) {
      cropW = stageW * 0.85;
      cropH = cropW / ratio;
    } else {
      cropH = stageH * 0.85;
      cropW = cropH * ratio;
    }
    this._state.cropW = cropW;
    this._state.cropH = cropH;
    this._state.cropX = (stageW - cropW) / 2;
    this._state.cropY = (stageH - cropH) / 2;

    // 计算图片缩放（cover 模式，填满裁剪框）
    const img = this._state.imageInfo;
    const imgRatio = img.width / img.height;
    let drawW, drawH;
    if (imgRatio > ratio) {
      // 图片比裁剪框更宽 -> 高度填满
      drawH = cropH;
      drawW = drawH * imgRatio;
    } else {
      drawW = cropW;
      drawH = drawW / imgRatio;
    }
    this._state.baseDrawW = drawW;
    this._state.baseDrawH = drawH;
    this._state.baseOffsetX = (stageW - drawW) / 2;
    this._state.baseOffsetY = (stageH - drawH) / 2;
  },

  _draw() {
    const ctx = this._state.ctx;
    const W = this._state.stageW;
    const H = this._state.stageH;
    if (!ctx) return;

    // 1. 清空画布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    const img = this._state.imageInfo.image;
    const s = this._state;

    // 2. 计算最终变换
    const finalW = s.baseDrawW * s.scale;
    const finalH = s.baseDrawH * s.scale;
    const finalX = s.baseOffsetX + s.offsetX;
    const finalY = s.baseOffsetY + s.offsetY;

    // 3. 应用变换
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (s.rotate) {
      ctx.rotate(s.rotate * Math.PI / 180);
    }
    if (s.flipH) ctx.scale(-1, 1);
    if (s.flipV) ctx.scale(1, -1);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(img, finalX, finalY, finalW, finalH);
    ctx.restore();

    // 4. 画暗色遮罩（裁剪框外面）
    const cx = s.cropX;
    const cy = s.cropY;
    const cw = s.cropW;
    const ch = s.cropH;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    // 上
    ctx.fillRect(0, 0, W, cy);
    // 下
    ctx.fillRect(0, cy + ch, W, H - cy - ch);
    // 左
    ctx.fillRect(0, cy, cx, ch);
    // 右
    ctx.fillRect(cx + cw, cy, W - cx - cw, ch);

    // 5. 画亮色裁剪框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // 6. 画九宫格辅助线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(cx + cw * i / 3, cy);
      ctx.lineTo(cx + cw * i / 3, cy + ch);
      ctx.moveTo(cx, cy + ch * i / 3);
      ctx.lineTo(cx + cw, cy + ch * i / 3);
    }
    ctx.stroke();
  },

  onTouchStart(e) {
    const touches = e.touches;
    this._state.touches = touches.map(t => ({ x: t.x, y: t.y }));
    if (touches.length === 2) {
      this._state.lastDistance = this._distance(touches[0], touches[1]);
      this._state.lastCenter = this._center(touches[0], touches[1]);
    }
  },

  onTouchMove(e) {
    const touches = e.touches;
    if (touches.length === 2) {
      // 双指缩放
      const distance = this._distance(touches[0], touches[1]);
      const delta = distance / this._state.lastDistance;
      const newScale = Math.max(0.5, Math.min(5, this._state.scale * delta));
      this._state.scale = newScale;
      this._state.lastDistance = distance;
    } else if (touches.length === 1) {
      // 单指拖动
      const dx = touches[0].x - this._state.touches[0].x;
      const dy = touches[0].y - this._state.touches[0].y;
      this._state.offsetX += dx;
      this._state.offsetY += dy;
      this._state.touches = [{ x: touches[0].x, y: touches[0].y }];
    }
    this._draw();
  },

  onTouchEnd() {
    this._state.lastDistance = 0;
  },

  _distance(t1, t2) {
    return Math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2);
  },
  _center(t1, t2) {
    return { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };
  },

  onRatioChange(e) {
    const ratio = e.currentTarget.dataset.ratio;
    this.setData({ ratio });
    this._fitToStage();
    this._draw();
  },

  onRotate() {
    this._state.rotate = (this._state.rotate + 90) % 360;
    this._draw();
  },

  onFlipH() {
    this._state.flipH = !this._state.flipH;
    this._draw();
  },

  onFlipV() {
    this._state.flipV = !this._state.flipV;
    this._draw();
  },

  onReset() {
    this._state.scale = 1;
    this._state.rotate = 0;
    this._state.flipH = false;
    this._state.flipV = false;
    this._state.offsetX = 0;
    this._state.offsetY = 0;
    this._fitToStage();
    this._draw();
  },

  onCancel() {
    const channel = this.getOpenerEventChannel();
    if (channel) channel.emit('cropped', null);
    wx.navigateBack();
  },

  onConfirm() {
    // 截图
    const { canvas, ctx, cropX, cropY, cropW, cropH, stageW, stageH } = this._state;
    const dpr = wx.getSystemInfoSync().pixelRatio;
    // 创建临时 canvas
    wx.createOffscreenCanvas({
      type: '2d',
      width: cropW * dpr,
      height: cropH * dpr,
      success: (offCanvas) => {
        const offCtx = offCanvas.getContext('2d');
        offCtx.scale(dpr, dpr);
        // 把 stage canvas 裁剪区绘制到 offscreen
        // 简化做法：重新绘制一次图片，只绘制裁剪区
        this._drawToOffscreen(offCtx, cropW, cropH);
        // 输出为临时文件
        wx.canvasToTempFilePath({
          canvas: offCanvas,
          x: 0,
          y: 0,
          width: cropW * dpr,
          height: cropH * dpr,
          destWidth: cropW * dpr,
          destHeight: cropH * dpr,
          fileType: 'jpg',
          quality: 0.9,
          success: (res) => {
            const channel = this.getOpenerEventChannel();
            if (channel) channel.emit('cropped', { tempPath: res.tempFilePath });
            wx.navigateBack();
          },
          fail: (err) => {
            console.error('[cropper] 输出失败', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      }
    });
  },

  _drawToOffscreen(ctx, w, h) {
    // 把图按最终变换画到 w×h 的 offscreen 中
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const img = this._state.imageInfo.image;
    const s = this._state;
    const finalW = s.baseDrawW * s.scale;
    const finalH = s.baseDrawH * s.scale;
    const finalX = s.baseOffsetX + s.offsetX;
    const finalY = s.baseOffsetY + s.offsetY;
    // 计算 crop 在 stage 中的位置对应的图片位置
    // 目标：让裁剪框 (cropX, cropY, cropW, cropH) 在 stage 的内容画到 (0, 0, w, h)
    // 即在图片坐标系中: cropX → 0, 所以 x' = finalX + (stageX - cropX) * 缩放
    // 简化：把 stage canvas 的对应区域画过来
    // 这里因为变换复杂，重新画图最稳
    const offsetX = finalX - s.cropX;
    const offsetY = finalY - s.cropY;
    const ratio = w / s.cropW;
    ctx.save();
    ctx.translate(-offsetX * ratio, -offsetY * ratio);
    ctx.scale(ratio, ratio);
    if (s.rotate) {
      ctx.translate(s.stageW / 2, s.stageH / 2);
      ctx.rotate(s.rotate * Math.PI / 180);
      ctx.translate(-s.stageW / 2, -s.stageH / 2);
    }
    if (s.flipH) ctx.scale(-1, 1);
    if (s.flipV) ctx.scale(1, -1);
    ctx.drawImage(img, finalX, finalY, finalW, finalH);
    ctx.restore();
  }
});
