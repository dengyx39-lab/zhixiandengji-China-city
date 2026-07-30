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

  // 主版图范围（排除南沙过南坐标，避免版图被拉高导致左右空一大片）
  const 地图范围 = { minLon: 73.2, maxLon: 135.2, minLat: 18.0, maxLat: 53.7 };

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
    const c = 制县计分.颜色[s];
    return {
      fillColor: c,
      weight: 1.1,
      color: '#555', // 可见市界
      opacity: 1,
      fillOpacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    };
  }

  function 省样式(feature) {
    const key = feature.properties.所属省;
    const info = 省汇总[key] || { 最高分: 0 };
    const c = 制县计分.颜色[info.最高分 || 0];
    return {
      fillColor: c,
      weight: 1.3,
      color: '#333', // 可见省界
      opacity: 1,
      fillOpacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
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

  function 投影工厂(rect, 范围, 横向压缩 = 1) {
    const { minLon, maxLon, minLat, maxLat } = 范围;
    const geoW = (maxLon - minLon) * 横向压缩;
    const geoH = maxLat - minLat;
    const scale = Math.min(rect.w / geoW, rect.h / geoH);
    const usedW = geoW * scale;
    const usedH = geoH * scale;
    const ox = rect.x + (rect.w - usedW) / 2;
    const oy = rect.y + (rect.h - usedH) / 2;
    return function project(lon, lat) {
      return [
        ox + (lon - minLon) * 横向压缩 * scale,
        oy + (maxLat - lat) * scale,
      ];
    };
  }

  function 画单个环(ctx, ring, project) {
    if (!ring || ring.length < 3) return;
    const p0 = project(ring[0][0], ring[0][1]);
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < ring.length; i++) {
      const p = project(ring[i][0], ring[i][1]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
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

  /**
   * 按每个 Polygon 单独填色，避免 MultiPolygon 共用 evenodd 在简化边界上“挖穿”成海蓝。
   */
  function 绘制多边形(ctx, geometry, project, fill, stroke) {
    const polys =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];

    for (const rings of polys) {
      if (!rings || !rings.length) continue;
      ctx.beginPath();
      // 只画外环填色（nonzero），内环洞用 evenodd 扣掉
      画单个环(ctx, rings[0], project);
      for (let i = 1; i < rings.length; i++) {
        画单个环(ctx, rings[i], project);
      }
      ctx.fillStyle = fill;
      if (rings.length > 1) ctx.fill('evenodd');
      else ctx.fill('nonzero');
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
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
    // 横向略压缩陆地轮廓（经度方向），让版图不那么“左右宽”
    const 横向压缩 = 0.82;
    const 范围 = 地图范围;
    const geoAspect = ((范围.maxLon - 范围.minLon) * 横向压缩) / (范围.maxLat - 范围.minLat);
    const 顶栏高 = 220;
    const 边距 = 48;
    const 地图高 = 5200;
    const 地图宽 = Math.round(地图高 * geoAspect);
    const W = 地图宽 + 边距 * 2;
    const H = 顶栏高 + 地图高 + 边距 + 36;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#a8d4f0';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(0, 0, W, 顶栏高);

    ctx.fillStyle = '#111';
    ctx.font = 'bold 84px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('制县等级 中国地级市版', 边距, 顶栏高 / 2);

    const 去过 = 统计去过();
    const 总分 = 制县计分.计算总分(分数表);
    ctx.textAlign = 'right';
    ctx.font = 'bold 56px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${去过}/${清单.length}`, W - 边距, 顶栏高 / 2 - 36);
    ctx.font = 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`总分 ${总分}`, W - 边距, 顶栏高 / 2 + 36);

    const mapRect = {
      x: 边距,
      y: 顶栏高 + 20,
      w: 地图宽,
      h: 地图高,
    };
    const project = 投影工厂(mapRect, 范围, 横向压缩);

    for (const f of 市FC.features) {
      const s = Number(分数表[f.properties.id]) || 0;
      绘制多边形(ctx, f.geometry, project, 制县计分.颜色[s], '#444');
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.fillStyle = '#111';
    for (const f of 市FC.features) {
      const c = 外环质心(f.geometry);
      if (!c) continue;
      if (c[1] < 16) continue; // 南沙标签不挤进主图
      if (c[0] < 范围.minLon || c[0] > 范围.maxLon) continue;
      if (c[1] < 范围.minLat || c[1] > 范围.maxLat) continue;
      const [x, y] = project(c[0], c[1]);
      ctx.strokeText(f.properties.名称, x, y);
      ctx.fillText(f.properties.名称, x, y);
    }

    // 更大的左下图例
    const lw = 1080;
    const lh = 860;
    const lx = 边距;
    const ly = H - 边距 - lh;
    圆角矩形(ctx, lx, ly, lw, lh, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText('图例', lx + 56, ly + 90);

    for (let i = 0; i <= 5; i++) {
      const rowY = ly + 200 + i * 100;
      ctx.fillStyle = 制县计分.颜色[i];
      ctx.fillRect(lx + 56, rowY - 36, 96, 72);
      ctx.strokeStyle = '#777';
      ctx.lineWidth = 3;
      ctx.strokeRect(lx + 56, rowY - 36, 96, 72);
      ctx.fillStyle = '#222';
      ctx.font = '60px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(`${i}  ${文案[i]}`, lx + 180, rowY);
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
    显示提示('正在生成高清全景图，请稍候…');
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
