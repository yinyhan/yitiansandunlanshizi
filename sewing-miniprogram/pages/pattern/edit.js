// pages/pattern/edit.js
const { getThemeClass } = require('../../utils/theme.js');
const patternSvc = require('../../services/pattern.js');
const fabricSvc = require('../../services/fabric.js');

Page({
  data: {
    themeClass: 'theme-apricot',
    isEdit: false,
    form: { matches: [] },
    tagsText: '',
    newMatch: { name: '', remark: '', parts: [] },
    customPart: '',
    fabricList: [],
    fabricNames: ['（未选）'],
    fabricMap: {}
  },

  onLoad(query) {
    const id = query.id;
    let form, isEdit = false;
    if (id) {
      form = patternSvc.getById(id) || {};
      isEdit = true;
    } else {
      form = { name: '', style: '', size: '', difficulty: '', remark: '', matches: [] };
    }
    const tagsText = (form.tags || []).join(' ');
    this.setData({ themeClass: getThemeClass(), form, isEdit, editId: id, tagsText });
    this.refreshFabrics();
  },

  onThemeChange(t) { this.setData({ themeClass: t }); },

  refreshFabrics() {
    const list = fabricSvc.listFabric();
    const fabricNames = ['（未选）', ...list.map((x) => `${x.name}（${x.color || ''}）`)];
    const fabricMap = { '': '（未选）' };
    list.forEach((x) => { fabricMap[x.id] = `${x.name}（${x.color || ''}）`; });
    this.setData({ fabricList: list, fabricNames, fabricMap });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onTagsInput(e) {
    const tagsText = e.detail.value;
    this.setData({ tagsText, 'form.tags': tagsText.split(/\s+/).filter(Boolean) });
  },

  onCutImageChange(e) {
    this.setData({ 'form.cutImage': e.detail.value || '' });
  },

  onTemplateImageChange(e) {
    this.setData({ 'form.templateImage': e.detail.value || '' });
  },

  onSave() {
    if (!this.data.form.name) { wx.showToast({ title: '请填写纸样名称', icon: 'none' }); return; }
    if (this.data.isEdit) {
      patternSvc.update(this.data.editId, this.data.form);
    } else {
      patternSvc.add(this.data.form);
    }
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  onDelete() {
    wx.showModal({
      title: '确认删除', content: '纸样与搭配方案都将删除',
      success: (res) => {
        if (res.confirm) {
          patternSvc.remove(this.data.editId);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }
      }
    });
  },

  // —— 部位联动 ——
  onMatchInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newMatch.${field}`]: e.detail.value });
  },

  onCustomPartInput(e) {
    this.setData({ customPart: e.detail.value });
  },

  onAddPart() {
    const part = (this.data.customPart || '').trim();
    if (!part) { wx.showToast({ title: '请输入部位名', icon: 'none' }); return; }
    if (this.data.newMatch.parts.some((p) => p.part === part)) {
      wx.showToast({ title: '部位已存在', icon: 'none' });
      return;
    }
    const parts = [...this.data.newMatch.parts, { part, fabricId: '', fabricIndex: 0 }];
    this.setData({ 'newMatch.parts': parts, customPart: '' });
  },

  onRemovePart(e) {
    const part = e.currentTarget.dataset.part;
    this.setData({ 'newMatch.parts': this.data.newMatch.parts.filter((p) => p.part !== part) });
  },

  onFabricPick(e) {
    const part = e.currentTarget.dataset.part;
    const index = Number(e.detail.value);
    const fabricId = index === 0 ? '' : this.data.fabricList[index - 1].id;
    const parts = this.data.newMatch.parts.map((p) => (p.part === part ? { ...p, fabricId, fabricIndex: index } : p));
    this.setData({ 'newMatch.parts': parts });
  },

  onSaveMatch() {
    const { newMatch } = this.data;
    if (!newMatch.parts.length) { wx.showToast({ title: '请至少添加一个部位', icon: 'none' }); return; }
    if (!newMatch.name) { wx.showToast({ title: '请输入方案名称', icon: 'none' }); return; }
    patternSvc.addMatch(this.data.editId, { name: newMatch.name, remark: newMatch.remark, parts: newMatch.parts });
    wx.showToast({ title: '已保存搭配', icon: 'success' });
    // 刷新 form
    const form = patternSvc.getById(this.data.editId);
    this.setData({ form, newMatch: { name: '', remark: '', parts: [] } });
  },

  onToggleFav(e) {
    const id = e.currentTarget.dataset.id;
    const form = patternSvc.getById(this.data.editId);
    form.matches = form.matches.map((m) => (m.id === id ? { ...m, favorite: !m.favorite } : m));
    patternSvc.update(this.data.editId, { matches: form.matches });
    this.setData({ form });
  },

  onDeleteMatch(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除搭配方案？',
      success: (res) => {
        if (!res.confirm) return;
        const form = patternSvc.getById(this.data.editId);
        form.matches = form.matches.filter((m) => m.id !== id);
        patternSvc.update(this.data.editId, { matches: form.matches });
        this.setData({ form });
      }
    });
  }
});
