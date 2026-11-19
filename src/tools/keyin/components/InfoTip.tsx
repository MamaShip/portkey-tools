// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 标题旁的「i」：鼠标悬停或键盘聚焦时显示说明，手机上点一下打开、再点关闭。
// 弹出层相对整个标题（.keyin-step）定位，窄屏上也不会超出卡片。
import { useId, useState, type ReactNode } from "react";

export default function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="keyin-info"
      data-open={open || undefined}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="keyin-info-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 11v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="7.6" r="1.25" fill="currentColor" />
        </svg>
      </button>
      <span role="tooltip" id={id} className="keyin-info-pop">
        {children}
      </span>
    </span>
  );
}
