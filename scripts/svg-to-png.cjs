// scripts/svg-to-png.js
// 把 assets/mood/*.svg 转成 96/192 两套 PNG（小程序 retina 适配）
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const MOOD_DIR = path.join(__dirname, '../sewing-miniprogram/assets/mood');
const SIZES = [96, 192]; // 小程序 1x/2x

const files = fs.readdirSync(MOOD_DIR).filter(f => f.endsWith('.svg'));
console.log(`Found ${files.length} SVGs`);

for (const f of files) {
  const svgPath = path.join(MOOD_DIR, f);
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  const baseName = f.replace('.svg', '');
  for (const size of SIZES) {
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(0,0,0,0)' // 透明背景
    });
    const pngData = resvg.render().asPng();
    const outPath = path.join(MOOD_DIR, `${baseName}@${size}.png`);
    fs.writeFileSync(outPath, pngData);
    console.log(`  ${baseName} -> ${baseName}@${size}.png (${pngData.length} bytes)`);
  }
}
console.log('Done.');
