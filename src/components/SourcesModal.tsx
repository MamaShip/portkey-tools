// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 「关于」弹窗：原独立 /copyright 页内移为 map 页内的信息弹窗（见 plan）。「来源与版权」为窗内一节。
// 构建期遍历 maps 登记表逐图列出来源/收藏/制图者/许可，新增一张图即自动出现，无需手工维护。
// 受控组件，open=false 时不渲染；状态由父级 MapViewer 持有。

import { maps } from "../data/maps";

const REPO = "https://github.com/MamaShip/portkey-tools";
// 三类反馈/贡献入口：直接打开对应的 GitHub Issue Form（模板在 .github/ISSUE_TEMPLATE/，
// 各自带好 labels/title）。?template= 的值即模板文件名。注意：Issue Forms 只在仓库
// 默认分支（master）上生效。
const ISSUE_LINKS = [
  { label: "反馈 bug", href: `${REPO}/issues/new?template=bug.yml` },
  { label: "提交老地图", href: `${REPO}/issues/new?template=new-map.yml` },
  {
    label: "提供校准数据",
    href: `${REPO}/issues/new?template=calibration.yml`,
  },
];

// 按年份升序展示（旧 → 新）。
const ordered = [...maps].sort((a, b) => a.year - b.year);

interface SourcesModalProps {
  open: boolean;
  onClose: () => void;
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 20, // 高于地图控件（MapInfo/Timeline/OpacityControl 用 z-index 1）
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  width: "min(92vw, 560px)",
  maxHeight: "85vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 12,
  padding: "20px 22px 22px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
  font: "14px/1.55 system-ui, sans-serif",
  color: "#222",
};

const closeStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 12,
  width: 30,
  height: 30,
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "#888",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const dtStyle: React.CSSProperties = { color: "#888" };
const ddStyle: React.CSSProperties = { margin: 0 };

const issueBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(0,0,0,0.02)",
  color: "#222",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

export default function SourcesModal({ open, onClose }: SourcesModalProps) {
  if (!open) return null;
  return (
    <div
      style={backdropStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="关于"
    >
      {/* 阻止冒泡：点击卡片内部不应关闭弹窗 */}
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeStyle} onClick={onClose} aria-label="关闭">
          ×
        </button>

        <h2 style={{ margin: "0 0 0.6rem", fontSize: "1.25rem" }}>关于</h2>

        <h3 style={{ margin: "0.4rem 0 0.5rem", fontSize: "1rem" }}>
          来源与版权
        </h3>
        <p style={{ marginTop: 0 }}>
          本站历史地图均取自公共领域（制图者多为当时政府机构）。下方逐图列出来源、收藏机构、制图者与许可状态。
        </p>

        {ordered.map((m) => (
          <section
            key={m.id}
            style={{
              margin: "1rem 0",
              padding: "0.85rem 1rem",
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
              {m.title}
              <span style={{ fontWeight: 400, color: "#888" }}>
                {" "}
                · {m.year}
              </span>
            </h3>
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.25rem 0.75rem",
              }}
            >
              <dt style={dtStyle}>来源 / 收藏</dt>
              <dd style={ddStyle}>{m.provenance.source}</dd>
              {m.provenance.author && (
                <>
                  <dt style={dtStyle}>制图者</dt>
                  <dd style={ddStyle}>{m.provenance.author}</dd>
                </>
              )}
              <dt style={dtStyle}>许可</dt>
              <dd style={ddStyle}>{m.provenance.license}</dd>
              {m.provenance.notes && (
                <>
                  <dt style={dtStyle}>备注</dt>
                  <dd style={ddStyle}>{m.provenance.notes}</dd>
                </>
              )}
            </dl>
          </section>
        ))}

        <p>
          现代底图 © OpenStreetMap 贡献者 / OpenFreeMap（地图角标自动署名）。
        </p>
        <p>
          配准标注（控制点）数据以 <strong>CC0</strong> 发布；站点代码以
          AGPL-3.0-or-later 授权。
        </p>

        <h3 style={{ margin: "1.2rem 0 0.5rem", fontSize: "1rem" }}>
          反馈与贡献
        </h3>
        <p style={{ marginTop: 0 }}>
          欢迎到 GitHub 提交 issue：报告
          bug、提供新的老地图，或贡献更准确的配准数据。
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {ISSUE_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={issueBtnStyle}
            >
              {l.label}
            </a>
          ))}
        </div>

        <h3 style={{ margin: "1.2rem 0 0.5rem", fontSize: "1rem" }}>
          侵权举报
        </h3>
        <p style={{ margin: 0 }}>
          若你认为某张图存在版权问题，请邮件联系{" "}
          <a href="mailto:youdangls@gmail.com">youdangls@gmail.com</a>
          ，我会将对应图片下架。
        </p>
      </div>
    </div>
  );
}
