import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(root, '计分.js')).href);
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
