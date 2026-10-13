// scripts/svg-to-png.cjs
// 用 @resvg/resvg-js 把 SVG 转 PNG
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '..', 'analysis', 'theme-preview.svg'), 'utf8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 800 },
  background: '#fafafa'
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
const out = path.join(__dirname, '..', 'analysis', 'theme-preview.png');
fs.writeFileSync(out, pngBuffer);
console.log(`✅ ${out}  (${(pngBuffer.length/1024).toFixed(1)}KB, ${pngData.width}x${pngData.height})`);
