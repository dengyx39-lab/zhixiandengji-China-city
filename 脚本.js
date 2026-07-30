(function () {
  const 市层阈值 = 6;
  const 分数表 = Object.create(null);
  let 清单 = [];
  let map;
  let 省层;
  let 市层 = null;
  let 市数据 = null; // 原始 GeoJSON，供高清导出
  let 省汇总 = {};
  let 市加载中 = null;
  let 市已就绪 = false;

  const 文案 = [
    '没去过',
    '玩过',
    '睡过',
    '居住 · 半年内',
    '居住 · 半年–2年',
    '居住 · 2年以上',
  ];

  // 中国大致范围（含南海诸岛略压缩到主图区）
  const 地图范围 = { minLon: 73, maxLon: 135, minLat: 18, maxLat: 54 };

  function 显示错误(msg) {
    const el = document.getElementById('错误');
    el.hidden = false;
    el.style.color = '#b00020';
    el.textContent = msg;
  }

  function 显示提示(msg) {
    const el = document.getElementById('错误');
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.style.color = '#135';
    el.textContent = msg;
  }

  function 刷新分数显示() {
    document.getElementById('分数').textContent = String(制县计分.计算总分(分数表));
    let 去过 = 0;
    for (const u of 清单) {
      if ((Number(分数表[u.id]) || 0) >= 1) 去过 += 1;
    }
    document.getElementById('去过数').textContent = String(去过);
    document.getElementById('总数').textContent = String(清单.length);
  }

  function 统计去过() {
    let 去过 = 0;
    for (const u of 清单) {
      if ((Number(分数表[u.id]) || 0) >= 1) 去过 += 1;
    }
    return 去过;
  }

  function 市样式(feature) {
    const s = Number(分数表[feature.properties.id]) || 0;
    return {
      fillColor: 制县计分.颜色[s],
      weight: 1,
      color: '#555',
      fillOpacity: 0.85,
    };
  }

  function 省样式(feature) {
    const key = feature.properties.所属省;
    const info = 省汇总[key] || { 最高分: 0 };
    return {
      fillColor: 制县计分.颜色[info.最高分 || 0],
      weight: 1.2,
      color: '#333',
      fillOpacity: 0.85,
    };
  }

  function 省标签(feature) {
    const key = feature.properties.所属省;
    const info = 省汇总[key] || { 去过: 0, 总数: 0 };
    return `${feature.properties.名称} ${info.去过}/${info.总数}`;
  }

  function 刷新上色() {
    省汇总 = 制县计分.按省汇总(清单, 分数表);
    if (市层) 市层.setStyle(市样式);
    if (省层) {
      省层.setStyle(省样式);
      省层.eachLayer((layer) => {
        if (layer.feature) layer.setTooltipContent(省标签(layer.feature));
      });
    }
    刷新分数显示();
  }

  function 创建市层(市) {
    return L.geoJSON(市, {
      style: 市样式,
      onEachFeature: (feature, layer) => {
        const id = feature.properties.id;
        const 名称 = feature.properties.名称;
        layer.bindTooltip(名称, {
          permanent: true,
          direction: 'center',
          className: '市标签',
        });
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const pt = map.mouseEventToContainerPoint(e.originalEvent);
          打开面板(id, 名称, pt);
        });
      },
    });
  }

  async function 确保市数据() {
    if (市数据) return 市数据;
    if (市加载中) {
      await 市加载中;
      return 市数据;
    }

    显示提示('正在加载市级地图…');
    市加载中 = fetch('数据/市.geojson')
      .then((r) => {
        if (!r.ok) throw new Error('市.geojson');
        return r.json();
      })
      .then((市) => {
        市数据 = 市;
        市层 = 创建市层(市);
        市已就绪 = true;
        显示提示('');
        return 市;
      })
      .catch((e) => {
        市加载中 = null;
        console.error(e);
        显示错误('市级地图加载失败，请刷新重试');
        throw e;
      });

    return 市加载中;
  }

  async function 确保市层() {
    await 确保市数据();
    return 市层;
  }

  async function 更新图层显隐() {
    if (!map) return;
    const z = map.getZoom();
    if (z >= 市层阈值) {
      try {
        const layer = await 确保市层();
        if (map.getZoom() < 市层阈值) return;
        if (map.hasLayer(省层)) map.removeLayer(省层);
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } catch (_) {
        /* 错误已展示 */
      }
    } else {
      if (市层 && map.hasLayer(市层)) map.removeLayer(市层);
      if (!map.hasLayer(省层)) map.addLayer(省层);
    }
  }

  function 关闭面板() {
    document.getElementById('面板').hidden = true;
  }

  function 打开面板(id, 名称, containerPoint) {
    const 面板 = document.getElementById('面板');
    document.getElementById('面板标题').textContent = 名称;
    const ul = document.getElementById('档位列表');
    ul.innerHTML = '';
    文案.forEach((t, 级别) => {
      const li = document.createElement('li');
      const 当前 = Number(分数表[id]) || 0;
      li.textContent = `${级别} ${t}${当前 === 级别 ? ' ✓' : ''}`;
      li.style.cursor = 'pointer';
      li.style.padding = '4px 0';
      li.onclick = () => {
        分数表[id] = 级别;
        刷新上色();
        关闭面板();
      };
      ul.appendChild(li);
    });
    面板.hidden = false;
    const pad = 8;
    const maxL = Math.max(pad, Math.min(containerPoint.x, window.innerWidth - 220));
    const maxT = Math.max(pad, Math.min(containerPoint.y, window.innerHeight - 280));
    面板.style.left = maxL + 'px';
    面板.style.top = maxT + 'px';
  }

  /** —— 高清全景导出（独立画布，不截屏幕） —— */

  function 投影工厂(rect) {
    const { minLon, maxLon, minLat, maxLat } = 地图范围;
    const geoW = maxLon - minLon;
    const geoH = maxLat - minLat;
    const scale = Math.min(rect.w / geoW, rect.h / geoH);
    const usedW = geoW * scale;
    const usedH = geoH * scale;
    const ox = rect.x + (rect.w - usedW) / 2;
    const oy = rect.y + (rect.h - usedH) / 2;
    return function project(lon, lat) {
      return [
        ox + (lon - minLon) * scale,
        oy + (maxLat - lat) * scale,
      ];
    };
  }

  function 遍历环(geometry, fn) {
    const t = geometry.type;
    const c = geometry.coordinates;
    if (t === 'Polygon') {
      c.forEach((ring) => fn(ring));
    } else if (t === 'MultiPolygon') {
      c.forEach((poly) => poly.forEach((ring) => fn(ring)));
    }
  }

  function 外环质心(geometry) {
    let ring = null;
    if (geometry.type === 'Polygon') ring = geometry.coordinates[0];
    else if (geometry.type === 'MultiPolygon') {
      let best = 0;
      geometry.coordinates.forEach((poly) => {
        if (poly[0] && poly[0].length > best) {
          best = poly[0].length;
          ring = poly[0];
        }
      });
    }
    if (!ring || !ring.length) return null;
    let sx = 0;
    let sy = 0;
    const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] ? 1 : 0);
    const count = Math.max(n, 1);
    for (let i = 0; i < count; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
    }
    return [sx / count, sy / count];
  }

  function 绘制多边形(ctx, geometry, project, fill, stroke) {
    ctx.beginPath();
    let firstRing = true;
    遍历环(geometry, (ring) => {
      if (!ring.length) return;
      const p0 = project(ring[0][0], ring[0][1]);
      if (firstRing) {
        ctx.moveTo(p0[0], p0[1]);
        firstRing = false;
      } else {
        ctx.moveTo(p0[0], p0[1]);
      }
      for (let i = 1; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1]);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
    });
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function 圆角矩形(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function 渲染全景图(市FC) {
    // 略收窄画布，减少左右留白；高度略增让地图更撑满
    const W = 6800;
    const H = 5800;
    const 顶栏高 = 200;
    const 边距 = 56;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 海面背景
    ctx.fillStyle = '#a8d4f0';
    ctx.fillRect(0, 0, W, H);

    // 顶栏白底
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 0, W, 顶栏高);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 88px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('制县等级 中国地级市版', 边距, 顶栏高 / 2);

    const 去过 = 统计去过();
    const 总分 = 制县计分.计算总分(分数表);
    ctx.textAlign = 'right';
    ctx.font = 'bold 58px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${去过}/${清单.length}`, W - 边距, 顶栏高 / 2 - 36);
    ctx.font = 'bold 66px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`总分 ${总分}`, W - 边距, 顶栏高 / 2 + 36);

    // 地图区域
    const mapRect = {
      x: 边距,
      y: 顶栏高 + 24,
      w: W - 边距 * 2,
      h: H - 顶栏高 - 边距 - 24,
    };
    const project = 投影工厂(mapRect);

    // 先画所有市填色
    for (const f of 市FC.features) {
      const s = Number(分数表[f.properties.id]) || 0;
      绘制多边形(ctx, f.geometry, project, 制县计分.颜色[s], '#444');
    }

    // 再画全部市名（缩略显小，放大可看清）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.fillStyle = '#111';
    for (const f of 市FC.features) {
      const c = 外环质心(f.geometry);
      if (!c) continue;
      if (c[0] < 地图范围.minLon || c[0] > 地图范围.maxLon) continue;
      if (c[1] < 地图范围.minLat || c[1] > 地图范围.maxLat) continue;
      const [x, y] = project(c[0], c[1]);
      const name = f.properties.名称;
      ctx.strokeText(name, x, y);
      ctx.fillText(name, x, y);
    }

    // 左下图例卡片（加大）
    const lw = 780;
    const lh = 620;
    const lx = 边距;
    const ly = H - 边距 - lh;
    圆角矩形(ctx, lx, ly, lw, lh, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 56px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText('图例', lx + 48, ly + 70);

    for (let i = 0; i <= 5; i++) {
      const rowY = ly + 150 + i * 74;
      ctx.fillStyle = 制县计分.颜色[i];
      ctx.fillRect(lx + 48, rowY - 26, 72, 52);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx + 48, rowY - 26, 72, 52);
      ctx.fillStyle = '#222';
      ctx.font = '48px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(`${i}  ${文案[i]}`, lx + 148, rowY);
    }

    return canvas;
  }

  function 下载Canvas(canvas, filename) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('toBlob failed'));
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        }, 'image/png');
      } else {
        try {
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = filename;
          a.click();
          resolve();
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  async function 生成高清全景() {
    关闭面板();
    显示提示('正在生成高清全景图（约 6800px，请稍候）…');
    await 确保市数据();
    // 让出主线程，避免按钮卡住无反馈
    await new Promise((r) => setTimeout(r, 40));
    const canvas = 渲染全景图(市数据);
    await 下载Canvas(canvas, '制县等级-中国地级市版-全景.png');
    显示提示('');
  }

  function 绑定按钮() {
    document.getElementById('重置视野').onclick = () => {
      map.setView([35.5, 105], 4);
      关闭面板();
    };
    document.getElementById('关闭面板').onclick = 关闭面板;
    document.getElementById('生成图片').onclick = async () => {
      try {
        await 生成高清全景();
      } catch (e) {
        console.error(e);
        显示错误('生成图片失败：浏览器可能内存不足，请关闭其它标签页后重试');
      }
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') 关闭面板();
    });
  }

  async function 启动() {
    if (typeof L === 'undefined' || typeof 制县计分 === 'undefined') {
      显示错误('脚本库加载失败');
      return;
    }

    try {
      const [省, 清] = await Promise.all([
        fetch('数据/省.geojson').then((r) => {
          if (!r.ok) throw new Error('省.geojson');
          return r.json();
        }),
        fetch('数据/清单.json').then((r) => {
          if (!r.ok) throw new Error('清单.json');
          return r.json();
        }),
      ]);

      清单 = 清;
      for (const u of 清单) 分数表[u.id] = 0;
      省汇总 = 制县计分.按省汇总(清单, 分数表);

      map = L.map('地图', {
        zoomControl: true,
        attributionControl: false,
        minZoom: 3,
        maxZoom: 12,
      }).setView([35.5, 105], 4);

      省层 = L.geoJSON(省, {
        style: 省样式,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(省标签(feature), {
            permanent: true,
            direction: 'center',
            className: '省标签',
          });
          layer.on('click', () => {
            map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 市层阈值 + 1 });
          });
        },
      });

      map.on('zoomend', () => {
        更新图层显隐();
      });
      map.on('click', 关闭面板);
      更新图层显隐();
      绑定按钮();
      刷新分数显示();
    } catch (e) {
      console.error(e);
      显示错误('数据加载失败：请用本地静态服务器打开（见 README）');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', 启动);
  } else {
    启动();
  }
})();
