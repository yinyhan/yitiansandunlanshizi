// utils/fabric-options.js
// 面料/辅料筛选的标准选项库
// 设计：静态标准选项（始终展示）+ 数据聚类（用户实际填过的）
//      合并去重，静态在前聚类在后

// 面料标准材质（用户即使没填过，也能直接看到）
const STATIC_MATERIALS = [
  '棉', '麻', '丝', '毛', '化纤', '混纺', '针织', '梭织', '雪纺', '牛仔', '灯芯绒', '皮革'
];

// 标准颜色（常见色卡）
const STATIC_COLORS = [
  '白', '黑', '灰', '米', '卡其', '藏青', '酒红', '粉', '蓝', '绿', '黄', '红', '紫', '棕'
];

// 标准面料分类
const STATIC_CATEGORIES = [
  '棉布', '西装料', '针织料', '里布', '雪纺', '牛仔', '灯芯绒', '丝绸', '呢料'
];

// 标准辅料分类（辅料页用）
const STATIC_AUX_CATEGORIES = [
  '纽扣', '拉链', '缝纫线', '衬布', '松紧带', '花边', '魔术贴', '挂钩', '垫肩', '口袋布'
];

/**
 * 合并：静态优先 + 数据聚类（去重 + 排序）
 * @param {string[]} staticList 静态标准选项
 * @param {string[]} dataList 从数据中提取的实际值
 * @returns {string[]} 合并后的去重数组
 */
function mergeOptions(staticList, dataList) {
  const set = new Set();
  // 1. 先加静态（保证顺序）
  staticList.forEach(x => {
    if (x) set.add(x);
  });
  // 2. 再加数据（去重）
  (dataList || []).forEach(x => {
    if (x) set.add(x);
  });
  return [...set];
}

module.exports = {
  STATIC_MATERIALS,
  STATIC_COLORS,
  STATIC_CATEGORIES,
  STATIC_AUX_CATEGORIES,
  mergeOptions
};
