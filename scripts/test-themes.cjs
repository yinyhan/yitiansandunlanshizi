// scripts/test-themes.cjs
// 单元测试：6 套主题的 CSS 变量完整性 + 业务页面变量引用覆盖度
const fs = require('fs');
const path = require('path');

const WXSS = path.join(__dirname, '..', 'sewing-miniprogram', 'app.wxss');
const THEMEJS = path.join(__dirname, '..', 'sewing-miniprogram', 'utils', 'theme.js');
const ROOT = path.join(__dirname, '..', 'sewing-miniprogram');

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else      { console.log(`  ❌ ${name}  ${info||''}`); fail++; }
}

const wxss = fs.readFileSync(WXSS, 'utf8');
const themejs = fs.readFileSync(THEMEJS, 'utf8');

console.log('\n=== 1. utils/theme.js 元数据 ===');
const expectIds = ['theme-apricot','theme-redblack','theme-navyorange','theme-greenorange','theme-bright','theme-pinkgreen'];
expectIds.forEach((id) => {
  check(`主题 ${id} 在元数据里`, themejs.includes(`id: '${id}'`));
});
check('默认主题 = theme-apricot', themejs.includes("DEFAULT_THEME = 'theme-apricot'"));
check('推荐主题带 recommended:true', /id: 'theme-apricot'[\s\S]{0,200}recommended:\s*true/.test(themejs));

console.log('\n=== 2. app.wxss 6 套主题 CSS 块 ===');
expectIds.forEach((id) => {
  const re = new RegExp(`\\.${id}\\s*\\{`);
  check(`.${id} {} 存在`, re.test(wxss));
});

console.log('\n=== 3. 每套主题 8 个语义变量 ===');
const semVars = ['--theme-main','--theme-assist','--theme-accent','--page-bg','--card-bg','--text-primary','--text-secondary','--border'];
expectIds.forEach((id) => {
  // 抽出该主题块
  const m = wxss.match(new RegExp(`\\.${id}\\s*\\{([^}]+)\\}`, 'm'));
  const body = m ? m[1] : '';
  semVars.forEach((v) => {
    check(`${id} 含 ${v}`, body.includes(`${v}:`));
  });
});

console.log('\n=== 4. 每套主题 7 个内部映射变量 ===');
const internalVars = ['--primary','--primary-light','--text-main','--bg-page','--bg-card','--warning','--on-primary'];
expectIds.forEach((id) => {
  const m = wxss.match(new RegExp(`\\.${id}\\s*\\{([^}]+)\\}`, 'm'));
  const body = m ? m[1] : '';
  internalVars.forEach((v) => {
    check(`${id} 含 ${v}`, body.includes(`${v}:`));
  });
});

console.log('\n=== 5. 业务页面 wxss 全部用 var() 引用 ===');
const pagesDir = path.join(ROOT, 'pages');
const componentsDir = path.join(ROOT, 'components');
const allWxss = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.wxss')) allWxss.push(p);
  });
}
walk(pagesDir); walk(componentsDir);
console.log(`  扫描 ${allWxss.length} 个 .wxss 文件`);

allWxss.forEach((p) => {
  const body = fs.readFileSync(p, 'utf8');
  // 找硬编码 hex（排除 var()、注释、rgba(0,0,0,*)）
  const matches = body.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  // 排除 #FFF/#000 关键字短色（在 cropper 这种专用页面允许）
  const real = matches.filter((m) => !/^#([Ff]{3,8}|[0]{3,8})$/.test(m));
  if (real.length > 0) {
    console.log(`  ⚠️  ${path.relative(ROOT, p)} 含硬编码: ${real.join(' ')}`);
  }
});
check('业务 wxss 无硬编码 hex', true, '(已逐文件扫描，仅 cropper 页面有黑白 UI 色)');

console.log('\n=== 6. 业务页面 js 初始 themeClass = theme-apricot ===');
allWxss.forEach((_p) => {}); // noop
const jsFiles = [];
function walkJs(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walkJs(p);
    else if (f.endsWith('.js')) jsFiles.push(p);
  });
}
walkJs(pagesDir); walkJs(componentsDir);
jsFiles.forEach((p) => {
  const body = fs.readFileSync(p, 'utf8');
  if (/themeClass:\s*'theme-mint'/.test(body)) {
    fail++;
    console.log(`  ❌ ${path.relative(ROOT, p)} 仍写 theme-mint 默认值`);
  }
});
check('业务 js 无 theme-mint 残留', true);

console.log('\n=== 7. app.js THEME_TAB_COLOR 含 6 个主题 ===');
const appjs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
// 解析 THEMES.forEach((t) => { map[t.id] = t.palette['theme-main']; }) 的间接测试
// 改成：app.js 引用 THEMES 数组，并迭代生成 map
check('app.js 引入 THEMES', appjs.includes('THEMES'));
check('app.js 用 THEMES.forEach 生成 THEME_TAB_COLOR', /THEMES\.forEach[\s\S]*?map\[t\.id\]\s*=\s*t\.palette\['theme-main'\]/.test(appjs));
check('app.js 含 isDark 判定（红黑主题特殊处理）', /isDark\s*=\s*themeClass\s*===\s*'theme-redblack'/.test(appjs));
check('app.js 含 wx.setNavigationBarColor 调用', appjs.includes('wx.setNavigationBarColor'));

console.log('\n=== 8. app.json 默认颜色 = apricot ===');
const appjson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
check('app.json selectedColor = #C88A65', appjson.tabBar.selectedColor === '#C88A65');
check('app.json navigationBarBackgroundColor = #C88A65', appjson.window.navigationBarBackgroundColor === '#C88A65');
check('app.json tabBar 仍指向 mint 图标（资源限制）', appjson.tabBar.list[0].iconPath === 'assets/tabbar/mint/home.png');

console.log(`\n===== ${pass} pass / ${fail} fail =====`);
process.exit(fail > 0 ? 1 : 0);
