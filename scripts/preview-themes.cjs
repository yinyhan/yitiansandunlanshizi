// scripts/preview-themes.cjs
// 解析 app.wxss 的 6 套主题，渲染成 6 张色卡 PNG，对比度检查
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 6 套主题的 8 个语义变量
const THEMES = [
  { id: 'theme-apricot',    name: '暖手作杏色', vars: {
    'theme-main':     '#C88A65',
    'theme-assist':   '#D4B59E',
    'theme-accent':   '#A05B37',
    'page-bg':        '#FFF9F2',
    'card-bg':        '#FFFFFF',
    'text-primary':   '#4A382C',
    'text-secondary': '#8C786A',
    'border':         '#EAE0D5'
  }},
  { id: 'theme-redblack',   name: '复古红黑', vars: {
    'theme-main':     '#9C2C2C',
    'theme-assist':   '#D44A4A',
    'theme-accent':   '#591616',
    'page-bg':        '#1F1F1F',
    'card-bg':        '#2D2D2D',
    'text-primary':   '#FFFFFF',
    'text-secondary': '#B8B8B8',
    'border':         '#444444'
  }},
  { id: 'theme-navyorange', name: '藏青橘撞色', vars: {
    'theme-main':     '#1A365D',
    'theme-assist':   '#FF7D29',
    'theme-accent':   '#0F243E',
    'page-bg':        '#F7F9FC',
    'card-bg':        '#FFFFFF',
    'text-primary':   '#222222',
    'text-secondary': '#666666',
    'border':         '#DCE3ED'
  }},
  { id: 'theme-greenorange',name: '墨绿橙黄', vars: {
    'theme-main':     '#285943',
    'theme-assist':   '#FFB037',
    'theme-accent':   '#1A3D2D',
    'page-bg':        '#F6F9F7',
    'card-bg':        '#FFFFFF',
    'text-primary':   '#242424',
    'text-secondary': '#596B62',
    'border':         '#D8E2DD'
  }},
  { id: 'theme-bright',     name: '明亮撞色', vars: {
    'theme-main':     '#0088EE',
    'theme-assist':   '#32DD32',
    'theme-accent':   '#FF4444',
    'page-bg':        '#FAFDFF',
    'card-bg':        '#FFFFFF',
    'text-primary':   '#111111',
    'text-secondary': '#555555',
    'border':         '#D8EFFF'
  }},
  { id: 'theme-pinkgreen',  name: '清甜粉绿', vars: {
    'theme-main':     '#E63980',
    'theme-assist':   '#36D377',
    'theme-accent':   '#FF7A30',
    'page-bg':        '#FFF8FB',
    'card-bg':        '#FFFFFF',
    'text-primary':   '#222222',
    'text-secondary': '#666666',
    'border':         '#F2DDE7'
  }}
];

// 简易相对亮度（WCAG 公式）
function lum(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2), 16) / 255;
  const g = parseInt(c.slice(2,4), 16) / 255;
  const b = parseInt(c.slice(4,6), 16) / 255;
  const f = (x) => x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4);
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
}
function contrast(a, b) {
  const la = lum(a), lb = lum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// 检查关键对比度
console.log('===== 主题对比度检查 =====');
THEMES.forEach((t) => {
  const v = t.vars;
  const c1 = contrast(v['text-primary'],   v['page-bg']).toFixed(2);
  const c2 = contrast(v['text-primary'],   v['card-bg']).toFixed(2);
  const c3 = contrast(v['text-secondary'], v['page-bg']).toFixed(2);
  const c4 = contrast(v['text-secondary'], v['card-bg']).toFixed(2);
  const c5 = contrast(v['on-primary'] || '#FFFFFF', v['theme-main']).toFixed(2);
  console.log(`\n[${t.id}] ${t.name}`);
  console.log(`  text-primary  vs page-bg:  ${c1}  ${c1 >= 4.5 ? '✅' : '⚠️ '}`);
  console.log(`  text-primary  vs card-bg:  ${c2}  ${c2 >= 4.5 ? '✅' : '⚠️ '}`);
  console.log(`  text-secondary vs page-bg: ${c3}  ${c3 >= 3.0 ? '✅' : '⚠️ '}`);
  console.log(`  text-secondary vs card-bg: ${c4}  ${c4 >= 3.0 ? '✅' : '⚠️ '}`);
  console.log(`  on-primary(#FFF) vs main:  ${c5}  ${c5 >= 4.5 ? '✅' : '⚠️ '}`);
});

// 生成 HTML 预览
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { background: #fafafa; font-family: -apple-system, sans-serif; padding: 24px; margin: 0; }
h1 { font-size: 24px; margin-bottom: 24px; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; max-width: 1200px; }
.card { border: 1px solid #ddd; border-radius: 12px; overflow: hidden; }
.head { padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.1); }
.head h2 { margin: 0 0 4px; font-size: 18px; }
.head p { margin: 0; font-size: 13px; opacity: 0.6; }
.body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.swatch-row { display: flex; gap: 12px; align-items: center; }
.swatch { display: flex; align-items: center; justify-content: center; width: 96px; height: 64px; border-radius: 8px; font-size: 11px; font-family: monospace; }
.demo { border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.btn { display: inline-block; padding: 8px 16px; border-radius: 999px; font-size: 14px; border: none; cursor: pointer; }
.tag { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
.stat-num { font-size: 32px; font-weight: 700; line-height: 1; }
</style></head><body>
<h1>6 套主题预览 · 微信小程序</h1>
<div class="grid">
${THEMES.map((t) => {
  const v = t.vars;
  return `<div class="card">
    <div class="head" style="background:${v['page-bg']}; color:${v['text-primary']};">
      <h2>${t.name}</h2>
      <p>${t.id}</p>
    </div>
    <div class="body" style="background:${v['page-bg']}; color:${v['text-primary']};">
      <div class="swatch-row">
        <div class="swatch" style="background:${v['theme-main']}; color:#fff;">${v['theme-main']}</div>
        <div class="swatch" style="background:${v['theme-assist']}; color:${v['text-primary']};">${v['theme-assist']}</div>
        <div class="swatch" style="background:${v['theme-accent']}; color:#fff;">${v['theme-accent']}</div>
        <div class="swatch" style="background:${v['page-bg']}; border:1px solid ${v['border']}; color:${v['text-primary']};">${v['page-bg']}</div>
        <div class="swatch" style="background:${v['card-bg']}; border:1px solid ${v['border']}; color:${v['text-primary']};">${v['card-bg']}</div>
        <div class="swatch" style="background:${v['border']}; color:${v['text-primary']};">${v['border']}</div>
      </div>
      <div class="demo" style="background:${v['card-bg']}; border:1px solid ${v['border']};">
        <button class="btn" style="background:${v['theme-main']}; color:#fff;">主按钮</button>
        <button class="btn" style="background:transparent; color:${v['theme-main']}; border:1px solid ${v['theme-main']};">次按钮</button>
        <span class="tag" style="background:${v['theme-assist']}; color:${v['text-primary']};">标签</span>
        <span class="tag" style="background:rgba(217,83,79,0.12); color:${v['theme-accent']};">警告</span>
        <span class="stat-num" style="color:${v['theme-main']};">42</span>
      </div>
      <div style="font-size:12px; color:${v['text-secondary']};">
        主文 4A382C · 副本 8C786A · 边框 EAE0D5
      </div>
    </div>
  </div>`;
}).join('')}
</div>
</body></html>`;

const out = path.join(__dirname, '..', 'analysis', 'theme-preview.html');
fs.writeFileSync(out, html);
console.log(`\n✅ 预览 HTML: ${out}`);

// 试着用 Chrome headless 截图（可选）
try {
  const png = out.replace('.html', '.png');
  execSync(`"${process.env.HOME}/Library/Application Support/Google/Chrome/Default" --headless --disable-gpu --hide-scrollbars --window-size=1240,1800 --screenshot="${png}" "file://${out}" 2>/dev/null`, { stdio: 'ignore' });
  console.log(`✅ 截图: ${png}`);
} catch (e) {
  console.log('（截图可选，未安装 Chrome 跳过）');
}
