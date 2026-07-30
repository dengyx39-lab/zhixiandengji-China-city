# 制县等级 · 国内版（地级）

静态 HTML 旅行足迹地图：地级行政区粒度，缩放后从省粗粒度切到市细粒度。

## 本地打开

不要直接双击 `index.html`（`file://` 下无法加载 GeoJSON）。在项目目录运行：

```bash
python3 -m http.server 8080
```

浏览器打开 <http://localhost:8080>。

## 性能说明

- 首屏只加载省界 + 清单（约数百 KB）
- 放大到市级后才下载 `市.geojson`（已压缩）
- 重建原始数据后可再压缩：

```bash
node 工具/构建地图数据.mjs
node 工具/压缩地图数据.mjs
node 工具/校验数据.mjs
```

## 计分自测

```bash
node 工具/计分自测.mjs
```
