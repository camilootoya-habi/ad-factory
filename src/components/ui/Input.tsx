"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onChange?: (value: string) => void;
};

export function Input({ className, onChange, ...rest }: InputProps) {
  return <input className={cx("input-brand", className)} onChange={(e) => onChange?.(e.target.value)} {...rest} />;
}

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  onChange?: (value: string) => void;
};

export function Textarea({ className, onChange, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cx("textarea-brand resize-y leading-snug", className)}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    />
  );
}

export type SelectOption<T extends string> = { value: T; label: string; disabled?: boolean };

export type SelectProps<T extends string> = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value: T | undefined;
  options: readonly SelectOption<T>[];
  onChange: (value: T | undefined) => void;
  /** Si se define, aparece una opción vacía con este texto y `undefined` es un valor válido. */
  emptyLabel?: string;
};

/** Select nativo tipado: el `""` del DOM va y viene como `undefined`. */
export function Select<T extends string>({ value, options, onChange, emptyLabel, className, ...rest }: SelectProps<T>) {
  return (
    <select
      className={cx("select-brand", className)}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : (v as T));
      }}
      {...rest}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
