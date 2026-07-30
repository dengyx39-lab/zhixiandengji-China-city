/**
 * 对已有 省/市 GeoJSON 再抽稀，减小体积（不重新下载）。
 * 用法: node 工具/压缩地图数据.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 数据 = path.join(root, '数据');

function 简化坐标(coords, stride) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') return coords;
  if (typeof coords[0][0] === 'number') {
    if (coords.length <= 6) return coords.map((p) => [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]);
    const out = [];
    for (let i = 0; i < coords.length; i += stride) {
      const p = coords[i];
      out.push([Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]);
    }
    const last = coords[coords.length - 1];
    const prev = out[out.length - 1];
    const lastP = [Number(last[0].toFixed(3)), Number(last[1].toFixed(3))];
    if (!prev || prev[0] !== lastP[0] || prev[1] !== lastP[1]) out.push(lastP);
    // 保证闭合且至少 4 点
    if (out.length < 4) {
      return coords.map((p) => [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]);
    }
    return out;
  }
  return coords.map((c) => 简化坐标(c, stride));
}

function 压缩FC(fc, stride) {
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
        coordinates: 简化坐标(f.geometry.coordinates, stride),
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

const 省 = JSON.parse(fs.readFileSync(省路径, 'utf8'));
const 市 = JSON.parse(fs.readFileSync(市路径, 'utf8'));
const 清单 = JSON.parse(fs.readFileSync(清单路径, 'utf8'));

fs.writeFileSync(省路径, JSON.stringify(压缩FC(省, 3)));
fs.writeFileSync(市路径, JSON.stringify(压缩FC(市, 4)));
fs.writeFileSync(清单路径, JSON.stringify(清单)); // 去掉缩进

console.log(`省: ${省前}MB -> ${mb(省路径)}MB`);
console.log(`市: ${市前}MB -> ${mb(市路径)}MB`);
console.log(`清单: ${(fs.statSync(清单路径).size / 1e3).toFixed(1)}KB`);
console.log('features', 市.features.length);
