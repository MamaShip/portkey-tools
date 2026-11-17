// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 简化的 Unicode 双向算法（UBA），移植自 keyin/text/shape.py。
// JavaScript 没有 Bidi_Class 查询，这里用文字（Script）属性近似：
// 从右往左的文字里的字母算 R，其余字母与间距组合符算 L，十进制数字算数字。

const RTL_SCRIPTS = [
  "Arabic",
  "Hebrew",
  "Syriac",
  "Thaana",
  "Nko",
  "Samaritan",
  "Mandaic",
  "Adlam",
  "Hanifi_Rohingya",
  "Mende_Kikakui",
  "Old_South_Arabian",
  "Old_North_Arabian",
  "Avestan",
  "Imperial_Aramaic",
  "Phoenician",
  "Kharoshthi",
  "Lydian",
  "Nabataean",
  "Palmyrene",
  "Manichaean",
  "Psalter_Pahlavi",
  "Inscriptional_Pahlavi",
  "Inscriptional_Parthian",
  "Hatran",
  "Old_Hungarian",
  "Old_Sogdian",
  "Sogdian",
  "Elymaic",
  "Chorasmian",
  "Yezidi",
  "Cypriot",
  "Meroitic_Cursive",
  "Meroitic_Hieroglyphs",
];
const RTL_LETTER = new RegExp(
  `^(?=\\p{L})[${RTL_SCRIPTS.map((s) => `\\p{Script=${s}}`).join("")}]$`,
  "u",
);
const LTR = /^[\p{L}\p{Mc}]$/u;
const NUMBER = /^\p{Nd}$/u;
const MARK = /^[\p{Mn}\p{Me}]$/u;
/** 在当前段的字体里有字形时，不另起一段的字符（标点、空格、符号、数字、组合符等） */
const STICKS = /^[\p{M}\p{Z}\p{P}\p{S}\p{N}\p{C}]$/u;

type Strong = "L" | "R" | "N" | null;

function strong(ch: string): Strong {
  if (RTL_LETTER.test(ch)) return "R";
  if (NUMBER.test(ch)) return "N";
  if (LTR.test(ch)) return "L";
  return null;
}

export const sticks = (ch: string) => STICKS.test(ch);

/**
 * 每个字符（按码位）的嵌入层级。基础方向取第一个强方向字母；
 * L/R 字母、数字、组合符按 W1/W7/I1/I2 定层级；中性字符两侧方向一致时随两侧（N1），
 * 否则取基础方向（N2）。
 */
export function embeddingLevels(chars: readonly string[]): {
  levels: number[];
  base: number;
} {
  const kinds = chars.map(strong);
  const first = kinds.find((k) => k === "L" || k === "R");
  const base = first === "R" ? 1 : 0;
  const lLevel = base ? 2 : 0;
  const levels: (number | null)[] = chars.map(() => null);
  const dirs: ("L" | "R" | null)[] = chars.map(() => null);
  let prevStrong: "L" | "R" = base ? "R" : "L";
  chars.forEach((ch, i) => {
    const k = kinds[i];
    if (k === "L") {
      levels[i] = lLevel;
      dirs[i] = "L";
      prevStrong = "L";
    } else if (k === "R") {
      levels[i] = 1;
      dirs[i] = "R";
      prevStrong = "R";
    } else if (k === "N") {
      // W7：紧跟 L 字母的数字按 L 处理；否则属于从右往左的文字，但数字本身仍从左往右（I1/I2）
      if (prevStrong === "L") {
        levels[i] = lLevel;
        dirs[i] = "L";
      } else {
        levels[i] = 2;
        dirs[i] = "R";
      }
    } else if (MARK.test(ch) && i > 0) {
      levels[i] = levels[i - 1]; // W1：组合符跟随前面的基字
      dirs[i] = dirs[i - 1];
    }
  });
  const resolved = levels.map((lv, i) => {
    if (lv !== null) return lv;
    let before: "L" | "R" | null = null;
    for (let j = i - 1; j >= 0 && !before; j--) before = dirs[j];
    let after: "L" | "R" | null = null;
    for (let j = i + 1; j < chars.length && !after; j++) after = dirs[j];
    if (before && before === after) return before === "L" ? lLevel : 1;
    return base;
  });
  return { levels: resolved, base };
}

/** 规则 L2：从最高层级往下，把每段层级 >= 当前层级的连续序列反转 */
export function visualOrder<T extends { level: number }>(
  runs: readonly T[],
): T[] {
  const order = [...runs];
  if (!order.length) return order;
  const top = Math.max(...order.map((r) => r.level));
  const odd = order.map((r) => r.level).filter((l) => l % 2);
  const lowestOdd = odd.length ? Math.min(...odd) : top + 1;
  for (let level = top; level >= lowestOdd; level--) {
    let i = 0;
    while (i < order.length) {
      if (order[i].level >= level) {
        let j = i;
        while (j < order.length && order[j].level >= level) j++;
        const reversed = order.slice(i, j).reverse();
        order.splice(i, j - i, ...reversed);
        i = j;
      } else {
        i++;
      }
    }
  }
  return order;
}
