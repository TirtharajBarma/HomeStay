"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

interface DateInputProps {
  id?: string;
  name?: string;
  value: string; // ISO format: YYYY-MM-DD
  min?: string;  // ISO format: YYYY-MM-DD
  max?: string;  // ISO format: YYYY-MM-DD
  onChange: (isoValue: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
}

/** Formats an ISO string (YYYY-MM-DD) into DD/MM/YYYY */
export function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Parses DD/MM/YYYY to ISO YYYY-MM-DD, or returns null if invalid */
export function ddmmyyyyToIso(ddmmyyyy: string): string | null {
  const clean = ddmmyyyy.trim();
  const match = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  const numD = Number(day);
  const numM = Number(month);
  const numY = Number(y);
  if (numM < 1 || numM > 12 || numD < 1 || numD > 31 || numY < 1900 || numY > 2100) {
    return null;
  }
  const daysInMonth = new Date(numY, numM, 0).getDate();
  if (numD > daysInMonth) return null;

  return `${y}-${month}-${day}`;
}

/** Auto-inserts slashes as the user types digits */
function formatRawDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  id,
  name,
  value,
  min,
  max,
  onChange,
  className = "",
  ariaLabel,
  placeholder = "DD/MM/YYYY",
  required,
}: DateInputProps) {
  const nativePickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string>(() => isoToDDMMYYYY(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync internal text state when external value changes
  if (value !== prevValue) {
    setPrevValue(value);
    setText(isoToDDMMYYYY(value));
  }

  const openCalendar = () => {
    if (nativePickerRef.current) {
      try {
        if (typeof nativePickerRef.current.showPicker === "function") {
          nativePickerRef.current.showPicker();
          return;
        }
      } catch {
        // Fallback for browsers with strict gesture policies
      }
      nativePickerRef.current.focus();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatRawDigits(raw);
    setText(formatted);

    // If 8 digits were typed (e.g. 13/10/2026), check if valid date and update parent immediately
    if (formatted.length === 10) {
      const iso = ddmmyyyyToIso(formatted);
      if (iso) {
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    if (!text) {
      setText(isoToDDMMYYYY(value));
      return;
    }
    const iso = ddmmyyyyToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDDMMYYYY(iso));
    } else {
      // Revert to valid value if typed text was invalid
      setText(isoToDDMMYYYY(value));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    const maybeIso = ddmmyyyyToIso(pasted) || (pasted.match(/^\d{4}-\d{2}-\d{2}$/) ? pasted : null);
    if (maybeIso) {
      e.preventDefault();
      onChange(maybeIso);
      setText(isoToDDMMYYYY(maybeIso));
    }
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (newIso) {
      setText(isoToDDMMYYYY(newIso));
      onChange(newIso);
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Formatted DD/MM/YYYY text input */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        required={required}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        aria-label={ariaLabel}
        className="h-full w-full min-w-0 bg-transparent pl-2 pr-7 text-xs sm:text-[13px] font-normal tabular-nums tracking-tight text-on-surface placeholder:text-outline focus:outline-none"
      />

      {/* Calendar icon trigger */}
      <button
        type="button"
        onClick={openCalendar}
        tabIndex={-1}
        aria-label="Open calendar date picker"
        title="Open calendar"
        className="absolute right-0 top-0 bottom-0 flex w-7 items-center justify-center rounded-r-md text-outline hover:text-primary transition-colors cursor-pointer"
      >
        <Icon name="calendar_today" className="text-[13px]" />
      </button>

      {/* Hidden native date input for browser calendar picker */}
      <input
        ref={nativePickerRef}
        type="date"
        name={name}
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        onChange={handleNativePickerChange}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
