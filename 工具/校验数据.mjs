import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 清单 = JSON.parse(fs.readFileSync(path.join(root, '数据/清单.json'), 'utf8'));
const 市 = JSON.parse(fs.readFileSync(path.join(root, '数据/市.geojson'), 'utf8'));
const 省 = JSON.parse(fs.readFileSync(path.join(root, '数据/省.geojson'), 'utf8'));

const ids = new Set(清单.map((x) => x.id));
const gids = 市.features.map((f) => f.properties.id);

if (清单.length !== 市.features.length) {
  console.error('count mismatch', 清单.length, 市.features.length);
  process.exit(1);
}
for (const id of gids) {
  if (!ids.has(id)) {
    console.error('extra in geojson', id);
    process.exit(1);
  }
}
for (const id of ids) {
  if (!gids.includes(id)) {
    console.error('missing in geojson', id);
    process.exit(1);
  }
}

const byName = Object.fromEntries(清单.map((x) => [x.名称, x]));
const must = ['乌鲁木齐市', '博尔塔拉蒙古自治州', '北京市', '香港特别行政区', '澳门特别行政区'];
for (const n of must) {
  if (!byName[n] && !清单.some((x) => x.名称.includes(n.replace(/市$|特别行政区$/, '')))) {
    // soft check variants
  }
}

const bj = 清单.filter((x) => x.所属省 === '北京');
const hk = 清单.filter((x) => x.所属省 === '香港');
const mo = 清单.filter((x) => x.所属省 === '澳门');
const tw = 清单.filter((x) => x.所属省 === '台湾');
const districts = 清单.filter((x) => /东城区|西城区|朝阳区/.test(x.名称));

console.log('OK', 清单.length);
console.log('省 features', 省.features.length);
console.log('北京单位数', bj.length, bj.map((x) => x.名称).join(','));
console.log('香港', hk.length, '澳门', mo.length, '台湾县市', tw.length);
if (bj.length !== 1) {
  console.error('北京应只有 1 个单位');
  process.exit(1);
}
if (hk.length !== 1 || mo.length !== 1) {
  console.error('港澳应各 1 个单位');
  process.exit(1);
}
if (tw.length < 10) {
  console.error('台湾县市过少', tw.length);
  process.exit(1);
}
if (districts.length) {
  console.error('不应出现直辖市辖区', districts.map((x) => x.名称));
  process.exit(1);
}
const hasUrumqi = 清单.some((x) => x.名称.includes('乌鲁木齐'));
const hasBortala = 清单.some((x) => x.名称.includes('博尔塔拉'));
if (!hasUrumqi || !hasBortala) {
  console.error('缺少新疆样本城市');
  process.exit(1);
}
console.log('抽查通过');
