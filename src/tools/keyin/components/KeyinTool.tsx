// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 刻印：把一年的每日使用记录做成可以 3D 打印的模型（STL）。React island 主体。
import { useMemo, useState } from "react";
import { yearsOf, summarize } from "../sources/daily";
import type { Scale, SkylineInput } from "../model/skyline";
import DataPanel, {
  SOURCES,
  type LoadedData,
  type SourceId,
} from "./DataPanel";
import Preview from "./Preview";
import { useBuilder } from "./useBuilder";
import "./keyin.css";

const SCALE_NAMES: Record<Scale, string> = {
  linear: "线性",
  sqrt: "平方根（压平极端值）",
  log: "对数（压得更平）",
};

const LANGS: [string, string][] = [
  ["", "自动"],
  ["zh-Hans", "简体中文"],
  ["zh-Hant", "繁体中文"],
  ["zh-HK", "中文（香港）"],
  ["ja", "日本語"],
  ["ko", "한국어"],
];

const fmt = (n: number, unit = "") =>
  n.toLocaleString("zh-CN", {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }) + (unit ? ` ${unit}` : "");

function downloadStl(stl: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([stl], { type: "model/stl" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function KeyinTool() {
  const [source, setSource] = useState<SourceId>("github");
  const [data, setData] = useState<LoadedData | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [scale, setScale] = useState<Scale | null>(null);
  const [lang, setLang] = useState("");

  const years = useMemo(() => (data ? yearsOf(data.values) : []), [data]);
  const activeYear =
    data?.year ?? (year !== null && years.includes(year) ? year : years[0]);
  const effectiveLabel = label ?? data?.label ?? "";
  const effectiveScale = scale ?? data?.scale ?? "linear";

  const input = useMemo<SkylineInput | null>(
    () =>
      data && activeYear
        ? {
            year: activeYear,
            label: effectiveLabel,
            userName: name,
            values: data.values,
            scale: effectiveScale,
          }
        : null,
    [data, activeYear, effectiveLabel, name, effectiveScale],
  );
  const build = useBuilder(input, lang || null);
  const summary =
    data && activeYear ? summarize(data.values, activeYear) : null;

  const pickSource = (id: SourceId) => {
    setSource(id);
    setData(null);
    setLabel(null);
    setScale(null);
    setYear(null);
  };

  return (
    <div className="keyin">
      <section className="keyin-card">
        <h2 className="keyin-step">
          <span>1</span>选择数据
        </h2>
        <div className="keyin-tabs" role="tablist" aria-label="数据源">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={source === s.id}
              className="keyin-tab"
              onClick={() => pickSource(s.id)}
            >
              <strong>{s.title}</strong>
              <small>{s.hint}</small>
            </button>
          ))}
        </div>
        <DataPanel key={source} source={source} onLoaded={setData} />
        {data && summary && (
          <p className="keyin-summary">
            {summary.activeDays
              ? `${activeYear} 年有 ${summary.activeDays} 天有记录，共 ${fmt(summary.total, data.unit)}，最多的一天是 ${summary.busiestDay}（${fmt(summary.busiest, data.unit)}）。`
              : `${activeYear} 年没有记录。`}
            {data.note && <span className="keyin-note">{data.note}</span>}
          </p>
        )}
        {data && !years.length && (
          <p className="keyin-error">没有读到任何记录。</p>
        )}
      </section>

      <section className="keyin-card" aria-disabled={!input}>
        <h2 className="keyin-step">
          <span>2</span>调整文字与外观
        </h2>
        <div className="keyin-grid">
          {!data?.year && (
            <label className="keyin-field">
              <span>年份</span>
              <select
                value={activeYear ?? ""}
                disabled={!years.length}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
          <label className="keyin-field">
            <span>名字</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="印在底座正面，可留空"
              maxLength={40}
            />
          </label>
          <label className="keyin-field">
            <span>平台名</span>
            <input
              value={effectiveLabel}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="印在左边，可留空"
              maxLength={30}
            />
          </label>
          <label className="keyin-field">
            <span>柱子高度</span>
            <select
              value={effectiveScale}
              onChange={(e) => setScale(e.target.value as Scale)}
            >
              {Object.entries(SCALE_NAMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="keyin-field">
            <span>汉字写法</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="keyin-card keyin-result">
        <h2 className="keyin-step">
          <span>3</span>预览与下载
        </h2>
        <div className="keyin-stage">
          <Preview positions={build.kind === "done" ? build.positions : null} />
          {build.kind === "idle" && (
            <p className="keyin-overlay">读取数据后，模型会出现在这里</p>
          )}
          {build.kind === "building" && (
            <p className="keyin-overlay" role="status">
              {build.font
                ? `正在下载字体 ${build.font.name}（${(build.font.total / 1e6).toFixed(1)} MB）… ${Math.round((100 * build.font.loaded) / build.font.total)}%`
                : "正在生成模型…"}
            </p>
          )}
          {build.kind === "error" && (
            <p className="keyin-overlay keyin-error" role="alert">
              {build.message}
            </p>
          )}
        </div>
        {build.kind === "done" && (
          <div className="keyin-actions">
            <button
              className="keyin-button keyin-primary"
              onClick={() =>
                downloadStl(
                  build.stl,
                  `keyin_${data?.source ?? "data"}_${activeYear}.stl`,
                )
              }
            >
              下载 STL（{(build.stl.byteLength / 1e6).toFixed(1)} MB）
            </button>
            <span className="keyin-hint">
              150 × 30 mm 底座，{build.triangles.toLocaleString("zh-CN")}{" "}
              个三角面，可直接导入切片软件。
            </span>
          </div>
        )}
        {build.kind === "done" &&
          build.warnings.map((w) => (
            <p key={w} className="keyin-warning">
              {w}
            </p>
          ))}
      </section>
    </div>
  );
}
