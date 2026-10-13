// pages/fabric/list.js
// 面料 / 辅料 列表页（带展开式多维度筛选）
const { getThemeClass } = require('../../utils/theme.js');
const fabricSvc = require('../../services/fabric.js');
const {
  STATIC_MATERIALS,
  STATIC_COLORS,
  STATIC_CATEGORIES,
  STATIC_AUX_CATEGORIES,
  mergeOptions
} = require('../../utils/fabric-options.js');

Page({
  data: {
    themeClass: 'theme-apricot',
    subTab: 'fabric',          // 'fabric' | 'aux'
    keyword: '',
    fabricList: [],
    auxList: [],
    filteredFabric: [],
    filteredAux: [],
    fabricCount: 0,
    auxCount: 0,

    // ====== 筛选（多选数组）======
    filter: {
      stock: [],        // ['low', 'enough']
      material: [],     // ['棉', '麻', ...]
      color: [],        // ['白', '黑', ...]
      category: []      // ['棉布', '纽扣', ...]
    },
    filterOpen: false,         // 筛选面板是否展开
    materialOptions: [],
    colorOptions: [],
    categoryOptions: [],
    auxCategoryOptions: [],
    isFilterEmpty: true,
    activeFilterCount: 0,
    activeFilterLabels: []
  },

  onLoad() {
    this.setData({ themeClass: getThemeClass() });
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData.themeClass) {
      app.applyTabBarTheme(app.globalData.themeClass);
    }
    this.refresh();
  },

  onThemeChange(themeClass) {
    this.setData({ themeClass });
  },

  refresh() {
    const fabricList = fabricSvc.listFabric();
    const auxList = fabricSvc.listAux();
    // 合并：静态标准 + 数据聚类（去重）
    const materials = mergeOptions(STATIC_MATERIALS, fabricList.map(x => x.material));
    const colors = mergeOptions(STATIC_COLORS, [
      ...fabricList.map(x => x.color),
      ...auxList.map(x => x.color)
    ]);
    const categories = mergeOptions(STATIC_CATEGORIES, fabricList.map(x => x.category));
    const auxCategories = mergeOptions(STATIC_AUX_CATEGORIES, auxList.map(x => x.category));

    this.setData({
      fabricList, auxList,
      filteredFabric: this.applyFilter(fabricList, this.data.keyword, this.data.filter, 'fabric'),
      filteredAux: this.applyFilter(auxList, this.data.keyword, this.data.filter, 'aux'),
      fabricCount: fabricList.length,
      auxCount: auxList.length,
      materialOptions: materials,
      colorOptions: colors,
      categoryOptions: categories,
      auxCategoryOptions: auxCategories
    });
    this._updateFilterSummary();
  },

  /**
   * 多条件过滤
   * @param {Array} list
   * @param {string} keyword
   * @param {Object} filter { stock, material, color, category }
   * @param {string} subType 'fabric' | 'aux'
   */
  applyFilter(list, keyword, filter, subType) {
    const k = (keyword || '').toLowerCase();
    return list.filter((x) => {
      // 1. 关键词
      if (k) {
        const hay = [x.name, x.material, x.color, x.spec, x.location, x.remark, x.category, (x.tags || []).join(' ')]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(k)) return false;
      }
      // 2. 库存状态（多选：low/enough 任一命中即通过）
      if (filter.stock && filter.stock.length) {
        const stock = subType === 'fabric' ? (x.stockLength || 0) : (x.stock || 0);
        const min = x.minStock || 0;
        const isLow = stock < min;
        const isEnough = stock >= min;
        const wantLow = filter.stock.indexOf('low') > -1;
        const wantEnough = filter.stock.indexOf('enough') > -1;
        if (wantLow && !isLow && wantEnough && !isEnough) return false;
        if (wantLow && !isLow && !wantEnough) return false;
        if (wantEnough && !isEnough && !wantLow) return false;
      }
      // 3. 材质（多选：fabric 才有效）
      if (subType === 'fabric' && filter.material && filter.material.length) {
        if (!x.material || filter.material.indexOf(x.material) === -1) return false;
      }
      // 4. 颜色（多选）
      if (filter.color && filter.color.length) {
        if (!x.color || filter.color.indexOf(x.color) === -1) return false;
      }
      // 5. 分类（多选：面料和辅料都支持）
      if (filter.category && filter.category.length) {
        if (!x.category || filter.category.indexOf(x.category) === -1) return false;
      }
      return true;
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    // 切换 tab 时重置筛选（因为面料和辅料的筛选维度不同）
    const filter = { stock: [], material: [], color: [], category: [] };
    this.setData({ subTab: tab, filter, filterOpen: false });
    this.refresh();
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      keyword,
      filteredFabric: this.applyFilter(this.data.fabricList, keyword, this.data.filter, 'fabric'),
      filteredAux: this.applyFilter(this.data.auxList, keyword, this.data.filter, 'aux')
    });
  },

  /** 切换筛选面板展开/收起 */
  onFilterToggle() {
    this.setData({ filterOpen: !this.data.filterOpen });
  },

  /**
   * 多选 chip 点击：toggle 选中
   */
  onFilterChip(e) {
    const { group, val } = e.currentTarget.dataset;
    const filter = { ...this.data.filter };
    const arr = filter[group] || [];
    const idx = arr.indexOf(val);
    if (idx > -1) arr.splice(idx, 1);
    else arr.push(val);
    filter[group] = arr;
    this.setData({ filter });
    // 应用筛选（实时，无需点"应用"按钮）
    this._applyFilterWithState(filter);
  },

  /** 应用筛选（点击底部"应用筛选"按钮） */
  onFilterApply() {
    this._applyFilterWithState(this.data.filter);
    this.setData({ filterOpen: false });
  },

  /** 重置 */
  onFilterClear() {
    const filter = { stock: [], material: [], color: [], category: [] };
    this.setData({ filter, filterOpen: false });
    this._applyFilterWithState(filter);
  },

  /** 点击摘要中的某个 chip 单独移除 */
  onRemoveChip(e) {
    const label = e.currentTarget.dataset.label;
    const filter = { ...this.data.filter };
    Object.keys(filter).forEach(k => {
      filter[k] = filter[k].filter(v => v !== label);
    });
    this.setData({ filter });
    this._applyFilterWithState(filter);
  },

  /** 内部：应用 filter 并刷新摘要 */
  _applyFilterWithState(filter) {
    this.setData({
      filteredFabric: this.applyFilter(this.data.fabricList, this.data.keyword, filter, 'fabric'),
      filteredAux: this.applyFilter(this.data.auxList, this.data.keyword, filter, 'aux')
    });
    this._updateFilterSummary(filter);
  },

  /** 计算 isFilterEmpty / activeFilterCount / activeFilterLabels */
  _updateFilterSummary(filter) {
    filter = filter || this.data.filter;
    const labels = [];
    if (filter.stock.indexOf('low') > -1) labels.push('库存不足');
    if (filter.stock.indexOf('enough') > -1) labels.push('充足');
    filter.material.forEach(v => labels.push(v));
    filter.color.forEach(v => labels.push(v));
    filter.category.forEach(v => labels.push(v));
    this.setData({
      isFilterEmpty: labels.length === 0,
      activeFilterCount: labels.length,
      activeFilterLabels: labels
    });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/fabric/edit?type=' + this.data.subTab });
  },

  onEdit(e) {
    wx.navigateTo({ url: '/pages/fabric/edit?type=' + this.data.subTab + '&id=' + e.currentTarget.dataset.id });
  }
});
