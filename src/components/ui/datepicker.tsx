import React from "react";
import DatePickerLib from "react-datepicker";
import { ko } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";

// Range 지원을 위한 확장형 DatePicker
export type DatePickerProps =
  | ({
      selected?: Date;
      onChange: (date: Date | null) => void;
      className?: string;
      placeholder?: string;
      range?: false;
    } & Omit<React.ComponentProps<typeof DatePickerLib>, 'selected' | 'onChange'>)
  | ({
      value?: [Date | null, Date | null];
      onChange: (date: [Date | null, Date | null]) => void;
      className?: string;
      placeholder?: string;
      range: true;
    } & React.ComponentProps<typeof DatePickerLib>);

export function DatePicker(props: DatePickerProps) {
  const { range, selected, value, onChange, className, placeholder, ...rest } = props as any;
  if (range) {
    // range 모드: value는 [start, end], onChange도 동일
    return (
      <DatePickerLib
        selectsRange
        startDate={value?.[0] || null}
        endDate={value?.[1] || null}
        onChange={date => {
          // react-datepicker는 date: [Date|null, Date|null] 또는 Date|null 반환
          if (Array.isArray(date)) {
            onChange(date as [Date | null, Date | null]);
          }
        }}
        dateFormat="yyyy-MM-dd"
        className={`h-8 px-3 border rounded-md bg-white text-xs w-full ${className || ""}`}
        popperProps={{ strategy: 'fixed' }}
        placeholderText={placeholder || "기간 선택"}
        autoComplete="off"
        isClearable
        locale={ko} // 한글 월/요일 표시
        {...rest}
      />
    );
  }
  // 단일 날짜 모드
  return (
    <DatePickerLib
      selected={selected || null}
      onChange={date => onChange(date as Date | null)}
      dateFormat="yyyy-MM-dd"
      className={`h-8 px-3 border rounded-md bg-white text-xs w-full ${className || ""}`}
      popperProps={{ strategy: 'fixed' }}
      placeholderText={placeholder || "날짜 선택"}
      autoComplete="off"
      locale={ko} // 한글 월/요일 표시
      {...rest}
    />
  );
}
