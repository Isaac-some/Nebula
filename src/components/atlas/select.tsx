"use client";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };
export default function AtlasSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  tone = "default",
  align = "start",
}: {
  id?: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  tone?: "default" | "status";
  align?: "start" | "end";
}) {
  return (
    <Select.Root<string>
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      items={options}
      disabled={disabled}
      modal={false}
    >
      <Select.Trigger
        id={id}
        aria-label={label}
        className={`atlas-select-trigger ${tone === "status" ? "status-select" : ""}`}
      >
        <Select.Value className="atlas-select-value" />
        <Select.Icon className="atlas-select-icon">
          <ChevronDown size={13} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="atlas-select-positioner"
          align={align}
          sideOffset={6}
          collisionPadding={12}
          alignItemWithTrigger={false}
        >
          <Select.Popup className="atlas-select-popup">
            <Select.List aria-label={label}>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="atlas-select-option"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="atlas-select-check">
                    <Check size={13} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
