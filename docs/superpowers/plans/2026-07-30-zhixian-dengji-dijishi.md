# 制县等级 · 国内版（地级）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个静态 HTML 地级足迹地图：省/市两层缩放切换、0–5 分打分加总、会话内导出 PNG、不持久化个人数据。

**Architecture:** 用公开行政区划 GeoJSON 提供边界多边形，Leaflet 负责缩放/点选/上色；分数只存在页面内存。构建脚本从阿里云 DataV 拉取大陆地级边界，直辖市/港澳用省级整块几何，台湾县市用 g0v 数据并简化后合并进 `数据/市.geojson`。

**Tech Stack:** HTML + CSS + 原生 JS；Leaflet；html2canvas；Node（仅构建数据脚本）；Python3（可选，用于校验/简化）。

## Global Constraints

- 可打分单位：大陆地级行政区 + 直辖市整块 + 台湾县市 + 港澳各 1
- 计分：0 没去过；1 玩过绿；2 睡过蓝；3 居住·半年内黄；4 居住·半年–2年橙；5 居住·2年以上红
- 总分 = 各单位分之和；满分 = N × 5
- 省粗粒度：省色 = 省内最高分；标签 = 去过市数/省内总市数（去过 = 分 ≥ 1）
- 不写 localStorage；分享链接不含个人数据；会话内可导出 PNG
- 静态文件结构对齐参考站风格（中文目录名可接受）

---

## 地图怎么画（先消除最大风险）

**我们不手绘 SVG path**（参考站那种把每个省的 path 写进 JS 的做法，扩到 300+ 市不现实）。

做法是三步：

1. **拿现成边界数据（GeoJSON）**  
   - 全国省界：`https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json`（已验证约 35 个省级 feature，含港澳台）  
   - 各省地级单位：`https://geo.datav.aliyun.com/areas_v3/bound/{省adcode}_full.json`（如河北返回石家庄、唐山等 `level=city`）  
   - **直辖市 / 香港 / 澳门**：其 `_full.json` 会拆到区，**不要用**；改用 `100000_full.json` 里的省级整块多边形当 1 个单位  
   - **台湾**：DataV 的 `710000_full.json` 不存在；用 [g0v/twgeojson](https://github.com/g0v/twgeojson) 县市面数据，构建时简化体积后并入

2. **本地合并成两个文件**  
   - `数据/省.geojson`：省粗粒度层  
   - `数据/市.geojson` + `数据/清单.json`：所有可打分单位

3. **Leaflet 上色**  
   ```js
   L.geoJSON(geojson, {
     style: (feature) => ({
       fillColor: 颜色[分数表[feature.properties.id] || 0],
       weight: 1,
       color: '#666',
       fillOpacity: 0.85,
     }),
     onEachFeature: (feature, layer) => {
       layer.on('click', () => 打开打分面板(feature.properties.id));
     },
   }).addTo(map);
   ```
   缩放用 Leaflet 自带的滚轮/双指；过阈值切换省层/市层显隐。

**风险与对策**

| 风险 | 对策 |
|---|---|
| 台湾无 DataV 细粒度 | 单独合并 g0v 县市 GeoJSON，并简化 |
| 直辖市 `_full` 是区 | 白名单：110000/120000/310000/500000/810000/820000 用省级几何 |
| 文件太大 | 构建时做坐标精度裁剪 / 简化；市层可按需加载但首版一次加载 |
| 坐标系 GCJ-02 | DataV 为 GCJ-02；纯色块足迹图无需底图瓦片，直接贴多边形即可 |

---

## File Structure

```
国内版（地级市）/
├── index.html
├── 样式.css
├── 脚本.js                 # 地图、计分、面板、导出
├── 计分.js                 # 纯函数：汇总/满分/省最高分（可测）
├── 数据/
│   ├── 省.geojson
│   ├── 市.geojson
│   └── 清单.json
├── 库/
│   ├── leaflet/
│   └── html2canvas/
├── 工具/
│   ├── 构建地图数据.mjs    # 下载+合并+写清单
│   └── 校验数据.mjs        # 清单与 GeoJSON 一致性
└── docs/superpowers/...
```

---

### Task 1: 页面骨架与本地库

**Files:**
- Create: `index.html`
- Create: `样式.css`
- Create: `库/leaflet/`（放入 leaflet.css / leaflet.js）
- Create: `库/html2canvas/html2canvas.min.js`

**Interfaces:**
- Produces: 可双击打开的空白页，含 `#地图` 容器与标题/图例/按钮占位

- [ ] **Step 1: 下载 Leaflet 与 html2canvas 到 `库/`**

```bash
cd "/Users/dengyx39/Desktop/制县等级/国内版（地级市）"
mkdir -p 库/leaflet 库/html2canvas
curl -sL "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" -o 库/leaflet/leaflet.css
curl -sL "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" -o 库/leaflet/leaflet.js
curl -sL "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js" -o 库/html2canvas/html2canvas.min.js
ls -la 库/leaflet 库/html2canvas
```

Expected: 三个文件非空。

- [ ] **Step 2: 写 `index.html` 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>制县等级 · 国内版</title>
  <link rel="stylesheet" href="库/leaflet/leaflet.css" />
  <link rel="stylesheet" href="样式.css" />
</head>
<body>
  <div id="应用">
    <header id="顶栏">
      <h1>制县等级 · 国内版 <span id="分数">0</span>/<span id="满分">0</span></h1>
      <table id="图例">
        <tr data-级别="0"><td>0</td><td>没去过</td></tr>
        <tr data-级别="1"><td>1</td><td>玩过</td></tr>
        <tr data-级别="2"><td>2</td><td>睡过</td></tr>
        <tr data-级别="3"><td>3</td><td>居住 · 半年内</td></tr>
        <tr data-级别="4"><td>4</td><td>居住 · 半年–2年</td></tr>
        <tr data-级别="5"><td>5</td><td>居住 · 2年以上</td></tr>
      </table>
      <div id="操作">
        <button type="button" id="重置视野">重置视野</button>
        <button type="button" id="生成图片">生成图片</button>
      </div>
    </header>
    <div id="地图"></div>
    <div id="面板" hidden>
      <h2 id="面板标题"></h2>
      <ul id="档位列表"></ul>
      <button type="button" id="关闭面板">关闭</button>
    </div>
    <p id="错误" hidden></p>
  </div>
  <script src="库/leaflet/leaflet.js"></script>
  <script src="库/html2canvas/html2canvas.min.js"></script>
  <script src="计分.js"></script>
  <script src="脚本.js"></script>
</body>
</html>
```

- [ ] **Step 3: 写基础 `样式.css`（地图全屏、顶栏浮层、图例色）**

```css
:root {
  --c0: #f2f2f2;
  --c1: #3cb371; /* 绿 */
  --c2: #4169e1; /* 蓝 */
  --c3: #ffd700; /* 黄 */
  --c4: #ff8c00; /* 橙 */
  --c5: #dc143c; /* 红 */
}
html, body, #应用, #地图 { height: 100%; margin: 0; }
#顶栏 {
  position: absolute; z-index: 1000; left: 12px; top: 12px;
  background: rgba(255,255,255,.92); padding: 12px; max-width: 280px;
}
#图例 tr[data-级别="0"] td:first-child { background: var(--c0); }
#图例 tr[data-级别="1"] td:first-child { background: var(--c1); }
#图例 tr[data-级别="2"] td:first-child { background: var(--c2); }
#图例 tr[data-级别="3"] td:first-child { background: var(--c3); }
#图例 tr[data-级别="4"] td:first-child { background: var(--c4); }
#图例 tr[data-级别="5"] td:first-child { background: var(--c5); }
#面板 {
  position: absolute; z-index: 1100; background: #fff; padding: 12px;
  border: 1px solid #ccc; min-width: 180px;
}
#错误 { position: absolute; z-index: 1200; left: 12px; bottom: 12px; color: #b00020; background: #fff; padding: 8px; }
```

- [ ] **Step 4: 浏览器打开 `index.html`，确认顶栏与空白地图容器出现**

- [ ] **Step 5: Commit**

```bash
git add index.html 样式.css 库
git commit -m "scaffolding: page shell and vendored leaflet/html2canvas"
```

---

### Task 2: 构建地图数据（核心）

**Files:**
- Create: `工具/构建地图数据.mjs`
- Create: `工具/校验数据.mjs`
- Create: `数据/省.geojson`（脚本生成）
- Create: `数据/市.geojson`（脚本生成）
- Create: `数据/清单.json`（脚本生成）

**Interfaces:**
- Produces:
  - `清单.json`: `Array<{ id: string, 名称: string, 所属省: string }>`
  - `市.geojson` / `省.geojson`: Feature `properties.id`、`properties.名称`、`properties.所属省` 与清单对齐
- 整块单位白名单 adcode：`110000,120000,310000,500000,810000,820000`（京沪津渝港澳）
- 台湾：从 g0v 合并，`所属省 = "台湾"`，`id = "TW-" + 县市名`

- [ ] **Step 1: 写 `工具/构建地图数据.mjs`（下载省界 + 各省 city + 特殊整块 + 台湾）**

关键逻辑（实现时按此编写完整可运行脚本）：

```js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', '数据');
const DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound';
const 整块 = new Set(['110000','120000','310000','500000','810000','820000']);
// 710000 台湾单独处理

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function 规范化省名(name) {
  return name
    .replace(/(维吾尔|回族|壮族)?自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '');
}

// 1) 省层 = 100000_full.json
// 2) 对每个非整块、非台湾省：拉 {adcode}_full.json，收集 level===city|district? 仅 city
//    新疆等自治州在 DataV 里 level 常为 city — 全部收入
// 3) 整块：从省层复制 geometry，id=adcode
// 4) 台湾：下载 g0v twCounty geojson，简化坐标后合并
// 5) 写 省.geojson / 市.geojson / 清单.json
```

台湾源（构建时下载一次）：

```text
https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json
```

简化：对每个 ring 按步长抽稀（例如每 N 个点取 1 个，或保留首尾），目标把台湾部分压到约 < 1MB；若仍过大再用更强抽稀。

直辖市/港澳：从省 FeatureCollection 取对应 feature，写入市层，`所属省` 用自身名称键（如 `北京`）。

- [ ] **Step 2: 运行构建**

```bash
node 工具/构建地图数据.mjs
```

Expected: `数据/` 下三个文件生成；控制台打印 `N=...`（市 feature 数）。

- [ ] **Step 3: 写并运行 `工具/校验数据.mjs`**

```js
import fs from 'fs';
const 清单 = JSON.parse(fs.readFileSync('数据/清单.json','utf8'));
const 市 = JSON.parse(fs.readFileSync('数据/市.geojson','utf8'));
const ids = new Set(清单.map(x => x.id));
const gids = 市.features.map(f => f.properties.id);
if (清单.length !== 市.features.length) {
  console.error('count mismatch', 清单.length, 市.features.length);
  process.exit(1);
}
for (const id of gids) if (!ids.has(id)) { console.error('extra', id); process.exit(1); }
for (const id of ids) if (!gids.includes(id)) { console.error('missing', id); process.exit(1); }
console.log('OK', 清单.length);
```

```bash
node 工具/校验数据.mjs
```

Expected: `OK <N>`

- [ ] **Step 4: 抽查** — 清单中含乌鲁木齐、博尔塔拉；北京只有 1 条；香港/澳门各 1；台湾多条县市；无北京「东城区」。

- [ ] **Step 5: Commit**

```bash
git add 工具 数据
git commit -m "data: build province/city geojson and unit list"
```

---

### Task 3: 纯计分模块

**Files:**
- Create: `计分.js`
- Create: `工具/计分自测.mjs`（用 node 跑断言；计分.js 需同时可在浏览器与 node 使用——用 `globalThis.计分 = ...` 或导出检测）

**Interfaces:**
- Produces:
  - `颜色 = ['#f2f2f2','#3cb371','#4169e1','#ffd700','#ff8c00','#dc143c']`
  - `计算总分(分数表) -> number`
  - `计算满分(单位数) -> number`  // 单位数 * 5
  - `按省汇总(清单, 分数表) -> { [所属省]: { 最高分, 去过, 总数 } }`

- [ ] **Step 1: 写自测（先失败）**

`工具/计分自测.mjs`：

```js
import { pathToFileURL } from 'url';
// 动态 import 或先要求 计分.js 挂到 globalThis
await import(pathToFileURL('./计分.js').href);
const { 计算总分, 计算满分, 按省汇总 } = globalThis.制县计分;
const 清单 = [
  { id: 'a', 名称: '甲', 所属省: '河北' },
  { id: 'b', 名称: '乙', 所属省: '河北' },
  { id: 'c', 名称: '丙', 所属省: '北京' },
];
const 分数表 = { a: 1, b: 5, c: 0 };
console.assert(计算总分(分数表) === 6, '总分');
console.assert(计算满分(3) === 15, '满分');
const s = 按省汇总(清单, 分数表);
console.assert(s['河北'].最高分 === 5, '最高分');
console.assert(s['河北'].去过 === 2 && s['河北'].总数 === 2, '河北去过');
console.assert(s['北京'].去过 === 0 && s['北京'].总数 === 1, '北京');
console.log('计分自测通过');
```

- [ ] **Step 2: 实现 `计分.js`**

```js
(function (g) {
  const 颜色 = ['#f2f2f2', '#3cb371', '#4169e1', '#ffd700', '#ff8c00', '#dc143c'];
  function 计算总分(分数表) {
    let t = 0;
    for (const k of Object.keys(分数表)) t += Number(分数表[k]) || 0;
    return t;
  }
  function 计算满分(单位数) { return 单位数 * 5; }
  function 按省汇总(清单, 分数表) {
    const out = {};
    for (const u of 清单) {
      const p = u.所属省;
      if (!out[p]) out[p] = { 最高分: 0, 去过: 0, 总数: 0 };
      out[p].总数 += 1;
      const s = Number(分数表[u.id]) || 0;
      if (s > out[p].最高分) out[p].最高分 = s;
      if (s >= 1) out[p].去过 += 1;
    }
    return out;
  }
  g.制县计分 = { 颜色, 计算总分, 计算满分, 按省汇总 };
})(globalThis);
```

- [ ] **Step 3: 跑自测**

```bash
node 工具/计分自测.mjs
```

Expected: `计分自测通过`

- [ ] **Step 4: Commit**

```bash
git add 计分.js 工具/计分自测.mjs
git commit -m "feat: pure scoring helpers with self-test"
```

---

### Task 4: Leaflet 加载两层地图 + 缩放切换

**Files:**
- Create: `脚本.js`（地图初始化部分）
- Modify: `样式.css`（如需）

**Interfaces:**
- Consumes: `数据/省.geojson`、`数据/市.geojson`、`数据/清单.json`、`globalThis.制县计分`
- Produces: `map`、`省层`、`市层`、`分数表`、`刷新上色()`、缩放阈值常量（如 `市层阈值 = 6`）

- [ ] **Step 1: 在 `脚本.js` 初始化地图（无底图瓦片，仅 GeoJSON）**

```js
const 市层阈值 = 6;
const 分数表 = Object.create(null);
let 清单 = [];
let map, 省层, 市层;

async function 启动() {
  try {
    const [省, 市, 清] = await Promise.all([
      fetch('数据/省.geojson').then(r => r.json()),
      fetch('数据/市.geojson').then(r => r.json()),
      fetch('数据/清单.json').then(r => r.json()),
    ]);
    清单 = 清;
    for (const u of 清单) 分数表[u.id] = 0;
    document.getElementById('满分').textContent = String(制县计分.计算满分(清单.length));
    map = L.map('地图', { zoomControl: true, attributionControl: false }).setView([35.5, 105], 4);
    // geoJSON layers...
    map.on('zoomend', 更新图层显隐);
    更新图层显隐();
    绑定按钮();
  } catch (e) {
    const el = document.getElementById('错误');
    el.hidden = false;
    el.textContent = '数据加载失败：请用本地静态服务器打开（见 README）';
    console.error(e);
  }
}
```

注意：`file://` 下 `fetch` 常失败——加 `README.md` 说明用：

```bash
npx --yes serve .
```

或 Python `python3 -m http.server`。

- [ ] **Step 2: 创建省层/市层 style 函数，接 `刷新上色()`**

省层 fillColor 取 `按省汇总` 的最高分颜色；市层取该市分数颜色。

- [ ] **Step 3: `更新图层显隐`**

```js
function 更新图层显隐() {
  const z = map.getZoom();
  if (z >= 市层阈值) {
    if (map.hasLayer(省层)) map.removeLayer(省层);
    if (!map.hasLayer(市层)) map.addLayer(市层);
  } else {
    if (map.hasLayer(市层)) map.removeLayer(市层);
    if (!map.hasLayer(省层)) map.addLayer(省层);
  }
}
```

- [ ] **Step 4: 省层 tooltip/label：`去过/总数`；点击省 `map.fitBounds(layer.getBounds())`**

- [ ] **Step 5: 手动验收** — `npx serve .` 打开；滚轮/双指缩放，阈值上下切换省/市；重置视野按钮 `map.setView([35.5,105],4)`

- [ ] **Step 6: Commit**

```bash
git add 脚本.js 样式.css README.md
git commit -m "feat: leaflet province/city layers with zoom switch"
```

---

### Task 5: 点选打分面板

**Files:**
- Modify: `脚本.js`
- Modify: `样式.css`

**Interfaces:**
- Consumes: 市层 click、`分数表`、`制县计分`
- Produces: 面板设置 `分数表[id]`、调用 `刷新上色()`、更新 `#分数`

- [ ] **Step 1: 市层 `onEachFeature` 绑定 click → `打开面板(id, 名称, latlng)`**

- [ ] **Step 2: 面板渲染 0–5；点击写入分数并关闭**

```js
function 打开面板(id, 名称, containerPoint) {
  const 面板 = document.getElementById('面板');
  document.getElementById('面板标题').textContent = 名称;
  const ul = document.getElementById('档位列表');
  ul.innerHTML = '';
  const 文案 = ['没去过','玩过','睡过','居住 · 半年内','居住 · 半年–2年','居住 · 2年以上'];
  文案.forEach((t, 级别) => {
    const li = document.createElement('li');
    li.textContent = `${级别} ${t}`;
    li.tabIndex = 0;
    li.onclick = () => {
      分数表[id] = 级别;
      刷新上色();
      document.getElementById('分数').textContent = String(制县计分.计算总分(分数表));
      面板.hidden = true;
    };
    ul.appendChild(li);
  });
  面板.hidden = false;
  面板.style.left = containerPoint.x + 'px';
  面板.style.top = containerPoint.y + 'px';
}
```

- [ ] **Step 3: 验收** — 点 3 个市分别打 1/3/5，总分正确；省层最高分色与 `去过/总数` 更新

- [ ] **Step 4: Commit**

```bash
git add 脚本.js 样式.css
git commit -m "feat: city score picker updates totals and styles"
```

---

### Task 6: 导出 PNG（会话内）

**Files:**
- Modify: `脚本.js`

**Interfaces:**
- `#生成图片` → html2canvas(`#应用`) → 下载 `制县等级-国内版.png`
- 不写入 localStorage；不修改 URL

- [ ] **Step 1: 实现导出**

```js
document.getElementById('生成图片').onclick = async () => {
  const node = document.getElementById('应用');
  const canvas = await html2canvas(node, { useCORS: true, backgroundColor: '#ffffff' });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = '制县等级-国内版.png';
  a.click();
};
```

若 Leaflet 矢量导出不完整：改为对 `#地图` 使用 `leaflet-image` 或临时提高 `preferCSSPageSize`；首版以 html2canvas 为准，不行则回退「提示用户系统截图」并修一层（优先修：导出前 `map.invalidateSize()`，或把 SVG path 所在 pane 纳入截取）。

- [ ] **Step 2: 验收** — 打分后导出 PNG，含标题分数与色块；刷新页面分数归零；地址栏无数据参数

- [ ] **Step 3: Commit**

```bash
git add 脚本.js
git commit -m "feat: session-only PNG export without persistence"
```

---

### Task 7: 体验收尾与验收对照

**Files:**
- Modify: `样式.css`、`脚本.js`、`README.md`
- Modify: `docs/superpowers/specs/2026-07-30-zhixian-dengji-dijishi-design.md`（状态改为已实现，可选）

- [ ] **Step 1: 移动端** — 去掉错误的 `user-scalable=no` 若妨碍双指；确保地图 `touchZoom`/`pinch` 开启（Leaflet 默认开）

- [ ] **Step 2: 市名标签** — 细粒度仅 `bindTooltip` 悬停/点击显示，避免全国标签爆炸

- [ ] **Step 3: 按设计文档 §8 验收标准逐条打勾**

1. 手机双指缩放，阈值切换省→市  
2. 电脑滚轮 + 点击打分  
3. 省色=最高分；标签去过/总数  
4. 总分与满分正确  
5. 刷新清空；URL 无个人数据  
6. 可导出 PNG  

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: polish UX and document local server usage"
```

---

## Self-Review（对照设计）

| 设计要求 | 对应任务 |
|---|---|
| 地级单位 + 直辖市整块 + 台县市 + 港澳各1 | Task 2 |
| 0–5 分与绿蓝黄橙红 | Task 1 图例 + Task 3/5 |
| 加总满分 N×5 | Task 3/4 |
| 缩放省粗/市细、省最高分、去过/总数 | Task 4/5 |
| 不落盘、分享无数据、会话导出 | Task 6 |
| 数据加载失败提示 | Task 4 |
| 静态 HTML 结构 | Task 1–2 |

无 TBD；台湾与直辖市特殊路径已写明对策。
