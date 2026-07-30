/**
 * 轻度压缩：只做坐标精度裁剪，不做抽稀，避免市界接缝开裂露底。
 * 用法: node 工具/压缩地图数据.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 数据 = path.join(root, '数据');

function 精简坐标(coords, digits = 3) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    return coords.map((n) => (typeof n === 'number' ? Number(n.toFixed(digits)) : n));
  }
  return coords.map((c) => 精简坐标(c, digits));
}

function 压缩FC(fc) {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      type: 'Feature',
      properties: {
        id: f.properties.id,
        名称: f.properties.名称,
        所属省: f.properties.所属省,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: 精简坐标(f.geometry.coordinates, 3),
      },
    })),
  };
}

function mb(file) {
  return (fs.statSync(file).size / 1e6).toFixed(2);
}

const 省路径 = path.join(数据, '省.geojson');
const 市路径 = path.join(数据, '市.geojson');
const 清单路径 = path.join(数据, '清单.json');

const 省前 = mb(省路径);
const 市前 = mb(市路径);

fs.writeFileSync(省路径, JSON.stringify(压缩FC(JSON.parse(fs.readFileSync(省路径, 'utf8')))));
fs.writeFileSync(市路径, JSON.stringify(压缩FC(JSON.parse(fs.readFileSync(市路径, 'utf8')))));
fs.writeFileSync(清单路径, JSON.stringify(JSON.parse(fs.readFileSync(清单路径, 'utf8'))));

console.log(`省: ${省前}MB -> ${mb(省路径)}MB`);
console.log(`市: ${市前}MB -> ${mb(市路径)}MB`);
console.log('轻度压缩完成（未抽稀边界）');
