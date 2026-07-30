(function () {
  const 市层阈值 = 6;
  const 分数表 = Object.create(null);
  let 清单 = [];
  let map;
  let 省层;
  let 市层 = null;
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

  function 显示错误(msg) {
    const el = document.getElementById('错误');
    el.hidden = false;
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

  async function 确保市层() {
    if (市已就绪 && 市层) return 市层;
    if (市加载中) return 市加载中;

    显示提示('正在加载市级地图…');
    市加载中 = fetch('数据/市.geojson')
      .then((r) => {
        if (!r.ok) throw new Error('市.geojson');
        return r.json();
      })
      .then((市) => {
        市层 = 创建市层(市);
        市已就绪 = true;
        显示提示('');
        document.getElementById('错误').style.color = '#b00020';
        return 市层;
      })
      .catch((e) => {
        市加载中 = null;
        console.error(e);
        显示错误('市级地图加载失败，请刷新重试');
        throw e;
      });

    return 市加载中;
  }

  async function 更新图层显隐() {
    if (!map) return;
    const z = map.getZoom();
    if (z >= 市层阈值) {
      try {
        const layer = await 确保市层();
        if (map.getZoom() < 市层阈值) return; // 加载期间又缩小了
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

  function 绑定按钮() {
    document.getElementById('重置视野').onclick = () => {
      map.setView([35.5, 105], 4);
      关闭面板();
    };
    document.getElementById('关闭面板').onclick = 关闭面板;
    document.getElementById('生成图片').onclick = async () => {
      try {
        关闭面板();
        map.invalidateSize();
        const node = document.getElementById('应用');
        const canvas = await html2canvas(node, {
          useCORS: true,
          backgroundColor: '#a8d4f0',
          logging: false,
        });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = '制县等级-中国地级市版.png';
        a.click();
      } catch (e) {
        console.error(e);
        显示错误('生成图片失败，可改用系统截图');
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
      // 首屏只拉省界 + 清单（轻量）；市界放大后再加载
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
