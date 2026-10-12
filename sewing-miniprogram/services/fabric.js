// services/fabric.js
// 布库 & 辅料 服务层
// 数据结构：
// fabric = [{ id, name, material, color, width, stockLength, unitPrice, location, category, remark, minStock, images: [], cover: '', createdAt }]
// aux    = [{ id, name, spec, stock, minStock, remark, images: [], cover: '', createdAt }]

const { get, set } = require('../utils/storage.js');
const { genId } = require('../utils/id.js');

const FABRIC_KEY = 'fabric';
const AUX_KEY = 'aux';

function listFabric() { return get(FABRIC_KEY, []); }
function listAux()    { return get(AUX_KEY, []); }

function saveFabric(list) { set(FABRIC_KEY, list); }
function saveAux(list)    { set(AUX_KEY, list); }

function addFabric(data) {
  const list = listFabric();
  const item = {
    id: genId('fab'),
    createdAt: Date.now(),
    images: [],
    cover: '',
    ...data
  };
  list.unshift(item);
  saveFabric(list);
  return item;
}

function addAux(data) {
  const list = listAux();
  const item = {
    id: genId('aux'),
    createdAt: Date.now(),
    images: [],
    cover: '',
    ...data
  };
  list.unshift(item);
  saveAux(list);
  return item;
}

function removeFabric(id) {
  saveFabric(listFabric().filter((x) => x.id !== id));
}
function removeAux(id) {
  saveAux(listAux().filter((x) => x.id !== id));
}

/** 库存预警列表（低于 minStock 的项） */
function lowStockAlerts() {
  const fabric = listFabric().filter((x) => (x.stockLength || 0) < (x.minStock || 0));
  const aux = listAux().filter((x) => (x.stock || 0) < (x.minStock || 0));
  return { fabric, aux, total: fabric.length + aux.length };
}

module.exports = {
  listFabric, listAux, saveFabric, saveAux,
  addFabric, addAux, removeFabric, removeAux, lowStockAlerts
};
