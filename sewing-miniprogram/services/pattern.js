// services/pattern.js
// 纸样 & 搭配 服务层
// 数据结构：
// pattern = [{ id, name, style, size, difficulty, tags[], images[], cutImage, templateImage, matches[{ id, name, parts[{ part, fabricId }], remark, favorite }], createdAt }]

const { get, set } = require('../utils/storage.js');
const { genId } = require('../utils/id.js');

const KEY = 'pattern';

function list() { return get(KEY, []); }
function save(list) { set(KEY, list); }

function add(data) {
  const list = list();
  const item = {
    id: genId('pat'),
    createdAt: Date.now(),
    matches: [],
    images: [],
    cutImage: '',
    templateImage: '',
    ...data
  };
  list.unshift(item);
  save(list);
  return item;
}

function update(id, patch) {
  const list = list().map((x) => (x.id === id ? { ...x, ...patch } : x));
  save(list);
}

function remove(id) {
  save(list().filter((x) => x.id !== id));
}

function getById(id) {
  return list().find((x) => x.id === id) || null;
}

function addMatch(patternId, match) {
  const item = getById(patternId);
  if (!item) return null;
  const newMatch = { id: genId('mch'), favorite: false, parts: [], ...match };
  const matches = [newMatch, ...(item.matches || [])];
  update(patternId, { matches });
  return newMatch;
}

module.exports = { list, save, add, update, remove, getById, addMatch };
