import * as React from "react";
import { Calendar } from "./calendar";

export function DatePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="h-9 px-3 border rounded-md bg-background text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        {value ? value.toLocaleDateString() : "날짜 선택"}
      </button>
      {open && (
        <div className="absolute z-50 bg-white border rounded-md mt-2 shadow-lg">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (date) {
                onChange(date as Date);
                setOpen(false);
              }
            }}
            initialFocus
          />
        </div>
      )}
    </div>
  );
} 