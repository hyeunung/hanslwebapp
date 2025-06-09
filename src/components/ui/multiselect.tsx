import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "./dropdown-menu";

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "선택하세요",
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="h-9 px-3 border rounded-md bg-background text-sm w-full text-left">
          {value.length === 0
            ? <span className="text-muted-foreground">{placeholder}</span>
            : options.filter(o => value.includes(o.value)).map(o => o.label).join(", ")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full" sideOffset={0} align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value.includes(option.value)}
            onCheckedChange={(checked) => {
              if (checked) onChange([...value, option.value]);
              else onChange(value.filter((v) => v !== option.value));
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 