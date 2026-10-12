// services/product.js
// 成品台账服务层
// 数据结构：
// product = [{ id, styleName, qty, finishedAt, hours, orderSource, status, remark, materials[{ id, type, refId, qty }], createdAt }]

const { get, set } = require('../utils/storage.js');
const { genId } = require('../utils/id.js');

const KEY = 'product';

function list() { return get(KEY, []); }
function save(list) { set(KEY, list); }

function add(data) {
  const list = list();
  const item = { id: genId('prd'), createdAt: Date.now(), materials: [], images: [], cover: '', ...data };
  list.unshift(item);
  save(list);
  return item;
}

function remove(id) {
  save(list().filter((x) => x.id !== id));
}

function getById(id) {
  return list().find((x) => x.id === id) || null;
}

module.exports = { list, save, add, remove, getById };
