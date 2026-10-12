// pages/fabric/edit.js
const { getThemeClass } = require('../../utils/theme.js');
const fabricSvc = require('../../services/fabric.js');

Page({
  data: {
    themeClass: 'theme-mint',
    type: 'fabric',
    isEdit: false,
    form: {}
  },

  onLoad(query) {
    const type = query.type || 'fabric';
    const id = query.id;
    let form;
    let isEdit = false;
    if (id) {
      const list = type === 'fabric' ? fabricSvc.listFabric() : fabricSvc.listAux();
      form = list.find((x) => x.id === id) || {};
      isEdit = true;
    } else {
      form = { name: '', stockLength: '', minStock: '', unitPrice: '', width: '', color: '', material: '', location: '', category: '', spec: '', stock: '', unit: '个', remark: '', images: [], cover: '' };
    }
    this.setData({ themeClass: getThemeClass(), type, form, isEdit, editId: id });
  },

  onThemeChange(themeClass) {
    this.setData({ themeClass });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onImagesChange(e) {
    const { value } = e.detail;
    this.setData({
      'form.images': value,
      'form.cover': value[0] || ''
    });
  },

  onSave() {
    const { type, form, isEdit, editId } = this.data;
    if (!form.name) {
      wx.showToast({ title: '请填写名称', icon: 'none' });
      return;
    }
    // 转数字字段
    const numFields = type === 'fabric'
      ? ['stockLength', 'minStock', 'unitPrice', 'width']
      : ['stock', 'minStock'];
    const data = { ...form };
    numFields.forEach((f) => { data[f] = Number(data[f] || 0); });

    if (type === 'fabric') {
      isEdit
        ? (fabricSvc.saveFabric(fabricSvc.listFabric().map((x) => (x.id === editId ? { ...x, ...data } : x))))
        : fabricSvc.addFabric(data);
    } else {
      isEdit
        ? (fabricSvc.saveAux(fabricSvc.listAux().map((x) => (x.id === editId ? { ...x, ...data } : x))))
        : fabricSvc.addAux(data);
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  onDelete() {
    const { type, editId } = this.data;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          if (type === 'fabric') fabricSvc.removeFabric(editId);
          else fabricSvc.removeAux(editId);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }
      }
    });
  }
});
