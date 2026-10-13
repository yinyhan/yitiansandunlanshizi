// pages/product/edit.js
const { getThemeClass } = require('../../utils/theme.js');
const productSvc = require('../../services/product.js');
const fabricSvc = require('../../services/fabric.js');
const { today: todayFn } = require('../../utils/date.js');

Page({
  data: {
    themeClass: 'theme-apricot',
    isEdit: false,
    form: { status: '已完成' },
    fabricList: [],
    fabricNames: ['（未选）'],
    fabricIndex: 0
  },

  onLoad(query) {
    const id = query.id;
    let form, isEdit = false;
    if (id) {
      form = productSvc.getById(id) || {};
      isEdit = true;
    } else {
      form = {
        styleName: '', qty: 1, finishedAt: todayFn(), hours: 0,
        orderSource: '', status: '已完成', remark: '', fabricName: '',
        images: [], cover: ''
      };
    }
    this.setData({ themeClass: getThemeClass(), form, isEdit, editId: id });
    this.refreshFabrics();
  },

  onThemeChange(t) { this.setData({ themeClass: t }); },

  refreshFabrics() {
    const fabricList = fabricSvc.listFabric();
    const fabricNames = ['（未选）', ...fabricList.map((x) => x.name)];
    this.setData({ fabricList, fabricNames });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ 'form.finishedAt': e.detail.value });
  },

  onFabricPick(e) {
    const idx = Number(e.detail.value);
    const fabricName = idx === 0 ? '' : this.data.fabricList[idx - 1].name;
    this.setData({ fabricIndex: idx, 'form.fabricName': fabricName });
  },

  onImagesChange(e) {
    const { value } = e.detail;
    this.setData({
      'form.images': value,
      'form.cover': value[0] || ''
    });
  },

  onSave() {
    const f = this.data.form;
    if (!f.styleName) { wx.showToast({ title: '请填写成品款式', icon: 'none' }); return; }
    const data = { ...f, qty: Number(f.qty || 0), hours: Number(f.hours || 0) };
    if (this.data.isEdit) {
      const list = productSvc.list().map((x) => (x.id === this.data.editId ? { ...x, ...data } : x));
      productSvc.save(list);
    } else {
      productSvc.add(data);
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  onDelete() {
    wx.showModal({
      title: '确认删除', content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          productSvc.remove(this.data.editId);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }
      }
    });
  }
});
