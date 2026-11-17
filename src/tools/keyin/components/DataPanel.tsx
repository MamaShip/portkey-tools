// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 第一步：选数据源、读数据。除 GitHub 外，文件都只在浏览器里解析，不上传。
import { useEffect, useState } from "react";
import {
  CLAUDE_METRICS,
  loadClaudeCode,
  type ClaudeMetric,
} from "../sources/claudeCode";
import { parseChatGpt } from "../sources/chatgpt";
import type { DailyValues } from "../sources/daily";
import {
  csvValues,
  guessDateColumn,
  parseCsv,
  parseJsonValues,
} from "../sources/files";
import { fetchGithub, FIRST_GITHUB_YEAR, GITHUB_USER } from "../sources/github";
import type { Scale } from "../model/skyline";

export type SourceId = "github" | "claude" | "chatgpt" | "file";

export interface LoadedData {
  source: SourceId;
  values: DailyValues;
  label: string;
  unit: string;
  scale: Scale;
  /** 只有一年数据的数据源（GitHub 按年请求）把年份带出来 */
  year?: number;
  note?: string;
}

export const SOURCES: { id: SourceId; title: string; hint: string }[] = [
  { id: "github", title: "GitHub", hint: "公开的贡献日历" },
  { id: "claude", title: "Claude Code", hint: "本地会话日志里的 token 用量" },
  { id: "chatgpt", title: "ChatGPT", hint: "数据导出里你发出的消息" },
  { id: "file", title: "自己的数据", hint: "JSON 或 CSV 文件" },
];

interface Props {
  source: SourceId;
  onLoaded: (data: LoadedData | null) => void;
}

const thisYear = new Date().getFullYear();

export default function DataPanel({ source, onLoaded }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (what: string, task: () => Promise<LoadedData>) => {
    setBusy(what);
    setError(null);
    try {
      onLoaded(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      onLoaded(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="keyin-data">
      {source === "github" && <GithubForm run={run} />}
      {source === "claude" && <ClaudeForm run={run} />}
      {source === "chatgpt" && <ChatGptForm run={run} />}
      {source === "file" && <FileForm run={run} />}
      {busy && (
        <p className="keyin-status" role="status">
          {busy}
        </p>
      )}
      {error && (
        <p className="keyin-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Run = (what: string, task: () => Promise<LoadedData>) => Promise<void>;

function GithubForm({ run }: { run: Run }) {
  const [user, setUser] = useState("");
  const [year, setYear] = useState(thisYear);
  const years = Array.from(
    { length: thisYear - FIRST_GITHUB_YEAR + 1 },
    (_, i) => thisYear - i,
  );
  const valid = GITHUB_USER.test(user.trim());
  const submit = () =>
    run("正在读取 GitHub 贡献日历…", async () => ({
      source: "github",
      values: await fetchGithub(user.trim(), year),
      label: "GitHub",
      unit: "次贡献",
      scale: "linear",
      year,
    }));
  return (
    <form
      className="keyin-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) submit();
      }}
    >
      <label className="keyin-field keyin-grow">
        <span>GitHub 用户名</span>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="例如 yihong0618"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="keyin-field">
        <span>年份</span>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="keyin-button" disabled={!valid}>
        读取
      </button>
      <p className="keyin-hint keyin-full">
        读取的是 GitHub 个人主页上公开的贡献日历，不需要登录或
        token。请求经本站服务器转发给 GitHub。
      </p>
    </form>
  );
}

function ClaudeForm({ run }: { run: Run }) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [metric, setMetric] = useState<ClaudeMetric>("total");

  useEffect(() => {
    if (!files) return;
    run("正在读取会话日志…", async () => {
      const r = await loadClaudeCode(files, metric);
      if (!r.files)
        throw new Error(
          "这个文件夹里没有 .jsonl 会话日志，请选择 ~/.claude/projects",
        );
      return {
        source: "claude",
        values: r.values,
        label: "Claude Code",
        unit: metric === "messages" ? "次回复" : "token",
        scale: "sqrt",
        note: `读取了 ${r.files} 个日志文件、${r.responses.toLocaleString("zh-CN")} 次回复`,
      };
    });
    // run 每次渲染都是新函数，这里只想在文件或统计方式变化时重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, metric]);

  return (
    <div className="keyin-row">
      <label className="keyin-field keyin-grow">
        <span>选择 Claude Code 的 projects 文件夹</span>
        <input
          type="file"
          multiple
          // 选择整个文件夹（各主流浏览器都支持，但不在标准类型里）
          {...{ webkitdirectory: "" }}
          onChange={(e) =>
            setFiles(e.target.files ? [...e.target.files] : null)
          }
        />
      </label>
      <label className="keyin-field">
        <span>统计</span>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as ClaudeMetric)}
        >
          {Object.entries(CLAUDE_METRICS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p className="keyin-hint keyin-full">
        位置：Windows 是 <code>C:\Users\你的用户名\.claude\projects</code>
        ，macOS / Linux 是 <code>~/.claude/projects</code>（macOS 的选择窗口里按{" "}
        <kbd>⌘</kbd>
        <kbd>⇧</kbd>
        <kbd>.</kbd>{" "}
        显示隐藏文件夹）。浏览器会提示「上传」，其实文件只在本页面里读取，不会离开你的电脑。
      </p>
    </div>
  );
}

function ChatGptForm({ run }: { run: Run }) {
  return (
    <div className="keyin-row">
      <label className="keyin-field keyin-grow">
        <span>选择 conversations.json</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            run("正在读取对话记录…", async () => ({
              source: "chatgpt",
              values: parseChatGpt(await f.text()),
              label: "ChatGPT",
              unit: "条消息",
              scale: "linear",
            }));
          }}
        />
      </label>
      <p className="keyin-hint keyin-full">
        在 ChatGPT 的 设置 → 数据控制 → 导出数据，邮件里的压缩包解压后就有
        conversations.json。 导出文件里没有 token
        数，这里统计你每天发出的消息数。文件只在本页面里读取。
      </p>
    </div>
  );
}

function FileForm({ run }: { run: Run }) {
  const [csv, setCsv] = useState<{
    rows: string[][];
    date: number;
    value: number | null;
  } | null>(null);

  useEffect(() => {
    if (!csv) return;
    run("正在读取 CSV…", async () => {
      const { values, skipped } = csvValues(csv.rows, csv.date, csv.value);
      if (!Object.keys(values).length)
        throw new Error("这一列里没有认出日期（格式应为 YYYY-MM-DD）");
      return {
        source: "file",
        values,
        label: "",
        unit: "",
        scale: "linear",
        note: skipped ? `跳过了 ${skipped} 行（日期或数值认不出）` : undefined,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv]);

  const header = csv?.rows[0] ?? [];
  return (
    <div className="keyin-row">
      <label className="keyin-field keyin-grow">
        <span>选择 JSON 或 CSV 文件</span>
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            if (f.name.toLowerCase().endsWith(".csv")) {
              const rows = parseCsv(text);
              setCsv({ rows, date: guessDateColumn(rows), value: null });
            } else {
              setCsv(null);
              run("正在读取 JSON…", async () => ({
                source: "file",
                values: parseJsonValues(text),
                label: "",
                unit: "",
                scale: "linear",
              }));
            }
          }}
        />
      </label>
      {csv && (
        <>
          <label className="keyin-field">
            <span>日期列</span>
            <select
              value={csv.date}
              onChange={(e) => setCsv({ ...csv, date: Number(e.target.value) })}
            >
              {header.map((h, i) => (
                <option key={i} value={i}>
                  {h || `第 ${i + 1} 列`}
                </option>
              ))}
            </select>
          </label>
          <label className="keyin-field">
            <span>数值列</span>
            <select
              value={csv.value ?? ""}
              onChange={(e) =>
                setCsv({
                  ...csv,
                  value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">每行计 1</option>
              {header.map((h, i) => (
                <option key={i} value={i}>
                  {h || `第 ${i + 1} 列`}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <p className="keyin-hint keyin-full">
        JSON 写成 <code>{'{"2025-01-01": 3, "2025-01-02": 8}'}</code>；CSV
        第一行是表头，选好日期列和数值列（不选数值列时每行计
        1）。文件只在本页面里读取。
      </p>
    </div>
  );
}
