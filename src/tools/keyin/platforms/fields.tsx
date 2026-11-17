// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 各平台表单共用的小控件。
import type { ReactNode } from "react";

export const thisYear = new Date().getFullYear();

export function Row({ children }: { children: ReactNode }) {
  return <div className="keyin-row">{children}</div>;
}

/** 选一个文件；accept 如 ".json" */
export function FileField({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  return (
    <label className="keyin-field keyin-grow">
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

/** 选整个文件夹（各主流浏览器都支持 webkitdirectory，但它不在标准类型里） */
export function FolderField({
  label,
  onFiles,
}: {
  label: string;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label className="keyin-field keyin-grow">
      <span>{label}</span>
      <input
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files]);
        }}
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secret = false,
  grow = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** token 之类：输入时遮住，不让浏览器记住 */
  secret?: boolean;
  grow?: boolean;
}) {
  return (
    <label className={`keyin-field${grow ? " keyin-grow" : ""}`}>
      <span>{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="keyin-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

export function YearField({
  value,
  onChange,
  first,
}: {
  value: number;
  onChange: (y: number) => void;
  first: number;
}) {
  const years = Array.from(
    { length: thisYear - first + 1 },
    (_, i) => thisYear - i,
  );
  return (
    <label className="keyin-field">
      <span>年份</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({
  disabled,
  children = "读取",
}: {
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button type="submit" className="keyin-button" disabled={disabled}>
      {children}
    </button>
  );
}

/** 表单外壳：回车或点按钮时提交 */
export function FormRow({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      className="keyin-row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
