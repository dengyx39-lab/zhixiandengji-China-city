import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', '数据');
const DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound';
const TW_URL =
  'https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json';

/** 直辖市 / 港澳：用省级整块，不拆区 */
const 整块 = new Set(['110000', '120000', '310000', '500000', '810000', '820000']);
const 台湾省代码 = '710000';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function 规范化省名(name) {
  return String(name)
    .replace(/(维吾尔|回族|壮族)?自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '');
}

/** 抽稀多边形坐标，控制台湾等大文件体积 */
function 简化坐标(coords, stride = 8) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') return coords;
  if (typeof coords[0][0] === 'number') {
    if (coords.length <= 4) return coords;
    const out = [];
    for (let i = 0; i < coords.length; i += stride) out.push(coords[i]);
    const last = coords[coords.length - 1];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== last[0] || prev[1] !== last[1]) out.push(last);
    return out.length >= 4 ? out : coords;
  }
  return coords.map((c) => 简化坐标(c, stride));
}

function 简化Feature(feature, stride) {
  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: {
      type: feature.geometry.type,
      coordinates: 简化坐标(feature.geometry.coordinates, stride),
    },
  };
}

function 精简精度(coords, digits = 4) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    return coords.map((n) => (typeof n === 'number' ? Number(n.toFixed(digits)) : n));
  }
  return coords.map((c) => 精简精度(c, digits));
}

function 精简Feature(feature) {
  return {
    type: 'Feature',
    properties: feature.properties,
    geometry: {
      type: feature.geometry.type,
      coordinates: 精简精度(feature.geometry.coordinates, 4),
    },
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('下载全国省界…');
  const 全国省 = await fetchJson(`${DATAV}/100000_full.json`);
  const 省features = 全国省.features
    .filter((f) => {
      const adcode = String(f.properties.adcode ?? '');
      // 跳过九段线等非省级要素（如 100000_JD）
      return /^\d{6}$/.test(adcode) && f.properties.level === 'province';
    })
    .map((f) => {
      const adcode = String(f.properties.adcode);
      const 名称 = f.properties.name;
      const 所属省 = 规范化省名(名称);
      return 精简Feature({
        type: 'Feature',
        properties: {
          id: adcode,
          名称,
          所属省,
          adcode,
          level: 'province',
        },
        geometry: f.geometry,
      });
    });

  const 省名byCode = new Map(
    省features.map((f) => [f.properties.adcode, f.properties.所属省])
  );

  const 市features = [];
  const 清单 = [];

  for (const pf of 省features) {
    const code = pf.properties.adcode;
    const 省键 = pf.properties.所属省;

    if (code === 台湾省代码) {
      console.log('跳过 DataV 台湾细拆，稍后合并 g0v…');
      continue;
    }

    if (整块.has(code)) {
      const id = code;
      const 名称 = pf.properties.名称;
      市features.push(
        精简Feature({
          type: 'Feature',
          properties: { id, 名称, 所属省: 省键, adcode: code, level: 'unit' },
          geometry: pf.geometry,
        })
      );
      清单.push({ id, 名称, 所属省: 省键 });
      console.log('整块单位', 名称, id);
      continue;
    }

    console.log('下载地级单位', pf.properties.名称, code);
    let full;
    try {
      full = await fetchJson(`${DATAV}/${code}_full.json`);
    } catch (e) {
      console.warn('失败，重试一次', code, e.message);
      await sleep(400);
      full = await fetchJson(`${DATAV}/${code}_full.json`);
    }

    for (const f of full.features || []) {
      const level = f.properties.level;
      // DataV 地级市/州/盟多为 city；排除 district
      if (level === 'district') continue;
      const adcode = String(f.properties.adcode);
      const 名称 = f.properties.name;
      const 所属省 = 省名byCode.get(code) || 省键;
      const id = adcode;
      市features.push(
        精简Feature({
          type: 'Feature',
          properties: { id, 名称, 所属省, adcode, level: level || 'city' },
          geometry: f.geometry,
        })
      );
      清单.push({ id, 名称, 所属省 });
    }
    await sleep(80);
  }

  console.log('下载台湾县市 (g0v)…');
  const tw = await fetchJson(TW_URL);
  for (const f of tw.features || []) {
    const 名称 = f.properties.name || f.properties.COUNTYNAME;
    if (!名称) continue;
    const id = `TW-${名称}`;
    const simplified = 精简Feature(
      简化Feature(
        {
          type: 'Feature',
          properties: { id, 名称, 所属省: '台湾', adcode: id, level: 'county' },
          geometry: f.geometry,
        },
        10
      )
    );
    市features.push(simplified);
    清单.push({ id, 名称, 所属省: '台湾' });
  }

  // 省层：台湾保留整岛轮廓（粗粒度标签用）；市层已有县市
  const 省FC = { type: 'FeatureCollection', features: 省features };
  const 市FC = { type: 'FeatureCollection', features: 市features };

  fs.writeFileSync(path.join(outDir, '省.geojson'), JSON.stringify(省FC));
  fs.writeFileSync(path.join(outDir, '市.geojson'), JSON.stringify(市FC));
  fs.writeFileSync(path.join(outDir, '清单.json'), JSON.stringify(清单, null, 2));

  console.log('完成 N=', 清单.length);
  console.log(
    '文件大小(MB)',
    (fs.statSync(path.join(outDir, '省.geojson')).size / 1e6).toFixed(2),
    (fs.statSync(path.join(outDir, '市.geojson')).size / 1e6).toFixed(2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
