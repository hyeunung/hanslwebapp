import React from "react";
import DatePickerLib from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";

export function DatePicker({ value, onChange, className, placeholder }: { value?: Date; onChange: (date: Date | null) => void; className?: string; placeholder?: string }) {
  return (
    <DatePickerLib
      selected={value || null}
      onChange={date => onChange(date)}
      dateFormat="yyyy-MM-dd"
      className={`h-8 px-3 border rounded-md bg-white text-xs w-full ${className || ""}`}
      popperProps={{ strategy: 'fixed' }}
      placeholderText={placeholder || "날짜 선택"}
      autoComplete="off"
    />
  );
} 