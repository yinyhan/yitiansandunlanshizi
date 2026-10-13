// scripts/preview-themes-svg.cjs
// 渲染 6 套主题为单个 SVG（不依赖 Chrome）
const fs = require('fs');
const path = require('path');

const THEMES = [
  { id: 'theme-apricot',    name: '暖手作杏色', vars: {
    'theme-main':     '#C88A65', 'theme-assist':   '#D4B59E',
    'theme-accent':   '#A05B37', 'page-bg':        '#FFF9F2',
    'card-bg':        '#FFFFFF', 'text-primary':   '#4A382C',
    'text-secondary': '#8C786A', 'border':         '#EAE0D5'
  }},
  { id: 'theme-redblack',   name: '复古红黑', vars: {
    'theme-main':     '#9C2C2C', 'theme-assist':   '#D44A4A',
    'theme-accent':   '#591616', 'page-bg':        '#1F1F1F',
    'card-bg':        '#2D2D2D', 'text-primary':   '#FFFFFF',
    'text-secondary': '#B8B8B8', 'border':         '#444444'
  }},
  { id: 'theme-navyorange', name: '藏青橘撞色', vars: {
    'theme-main':     '#1A365D', 'theme-assist':   '#FF7D29',
    'theme-accent':   '#0F243E', 'page-bg':        '#F7F9FC',
    'card-bg':        '#FFFFFF', 'text-primary':   '#222222',
    'text-secondary': '#666666', 'border':         '#DCE3ED'
  }},
  { id: 'theme-greenorange',name: '墨绿橙黄', vars: {
    'theme-main':     '#285943', 'theme-assist':   '#FFB037',
    'theme-accent':   '#1A3D2D', 'page-bg':        '#F6F9F7',
    'card-bg':        '#FFFFFF', 'text-primary':   '#242424',
    'text-secondary': '#596B62', 'border':         '#D8E2DD'
  }},
  { id: 'theme-bright',     name: '明亮撞色', vars: {
    'theme-main':     '#0088EE', 'theme-assist':   '#32DD32',
    'theme-accent':   '#FF4444', 'page-bg':        '#FAFDFF',
    'card-bg':        '#FFFFFF', 'text-primary':   '#111111',
    'text-secondary': '#555555', 'border':         '#D8EFFF'
  }},
  { id: 'theme-pinkgreen',  name: '清甜粉绿', vars: {
    'theme-main':     '#E63980', 'theme-assist':   '#36D377',
    'theme-accent':   '#FF7A30', 'page-bg':        '#FFF8FB',
    'card-bg':        '#FFFFFF', 'text-primary':   '#222222',
    'text-secondary': '#666666', 'border':         '#F2DDE7'
  }}
];

const COLS = 2;
const CELL_W = 600;
const CELL_H = 380;
const PAD = 24;
const ROWS = Math.ceil(THEMES.length / COLS);
const W = COLS * CELL_W + (COLS + 1) * PAD;
const H = ROWS * CELL_H + (ROWS + 1) * PAD + 80;

const swatches = [
  ['theme-main', '主色'],
  ['theme-assist', '辅助'],
  ['theme-accent', '强调'],
  ['page-bg', '页面底'],
  ['card-bg', '卡片底'],
  ['border', '边框']
];

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
  .title { font: 600 28px -apple-system, "PingFang SC", sans-serif; fill: #222; }
  .h2    { font: 600 20px -apple-system, "PingFang SC", sans-serif; }
  .meta  { font: 13px -apple-system, "PingFang SC", sans-serif; opacity: 0.7; }
  .mono  { font: 11px "SF Mono", "Menlo", monospace; }
  .lab   { font: 13px -apple-system, "PingFang SC", sans-serif; }
  .btn   { font: 14px -apple-system, "PingFang SC", sans-serif; font-weight: 500; }
</style>
<rect width="${W}" height="${H}" fill="#fafafa"/>
<text class="title" x="${PAD}" y="48">6 套主题预览</text>
`;

THEMES.forEach((t, idx) => {
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const x = PAD + col * (CELL_W + PAD);
  const y = 80 + PAD + row * (CELL_H + PAD);
  const v = t.vars;

  // 卡片外框
  svg += `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="12" fill="${v['card-bg']}" stroke="${v['border']}" stroke-width="1"/>`;
  // header
  svg += `<rect x="${x}" y="${y}" width="${CELL_W}" height="64" rx="12" fill="${v['page-bg']}"/>`;
  svg += `<rect x="${x}" y="${y + 52}" width="${CELL_W}" height="12" fill="${v['page-bg']}"/>`;
  svg += `<text class="h2" x="${x + 20}" y="${y + 28}" fill="${v['text-primary']}">${t.name}</text>`;
  svg += `<text class="meta" x="${x + 20}" y="${y + 50}" fill="${v['text-secondary']}">${t.id}</text>`;

  // 6 个色块（3×2）
  const sw = 90, sh = 70, sgap = 8;
  const swStartX = x + 20;
  const swStartY = y + 84;
  swatches.forEach(([key, lab], i) => {
    const sc = i % 3;
    const sr = Math.floor(i / 3);
    const sx = swStartX + sc * (sw + sgap);
    const sy = swStartY + sr * (sh + sgap + 18);
    svg += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="6" fill="${v[key]}" stroke="${v['border']}" stroke-width="1"/>`;
    svg += `<text class="lab" x="${sx}" y="${sy + sh + 14}" fill="${v['text-secondary']}">${lab} ${v[key]}</text>`;
  });

  // 按钮示例
  const bx = x + 20, by = y + 260;
  svg += `<rect x="${bx}" y="${by}" width="120" height="44" rx="22" fill="${v['theme-main']}"/>`;
  svg += `<text class="btn" x="${bx + 60}" y="${by + 28}" text-anchor="middle" fill="#FFFFFF">主按钮</text>`;
  svg += `<rect x="${bx + 132}" y="${by}" width="120" height="44" rx="22" fill="none" stroke="${v['theme-main']}" stroke-width="2"/>`;
  svg += `<text class="btn" x="${bx + 192}" y="${by + 28}" text-anchor="middle" fill="${v['theme-main']}">次按钮</text>`;
  svg += `<rect x="${bx + 264}" y="${by + 8}" width="80" height="28" rx="14" fill="${v['theme-assist']}"/>`;
  svg += `<text class="lab" x="${bx + 304}" y="${by + 26}" text-anchor="middle" fill="${v['text-primary']}">标签</text>`;
  svg += `<text class="h2" x="${bx + 460}" y="${by + 32}" fill="${v['theme-main']}">42</text>`;
});

svg += `</svg>`;

const out = path.join(__dirname, '..', 'analysis', 'theme-preview.svg');
fs.writeFileSync(out, svg);
console.log(`✅ ${out}  (${(svg.length/1024).toFixed(1)}KB)`);
