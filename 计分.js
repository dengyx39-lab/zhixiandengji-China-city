(function (g) {
  const 颜色 = ['#f2f2f2', '#3cb371', '#4169e1', '#ffd700', '#ff8c00', '#dc143c'];

  function 计算总分(分数表) {
    let t = 0;
    for (const k of Object.keys(分数表)) t += Number(分数表[k]) || 0;
    return t;
  }

  function 计算满分(单位数) {
    return 单位数 * 5;
  }

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
})(typeof globalThis !== 'undefined' ? globalThis : window);
