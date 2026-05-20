"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: ComboboxInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [showAll, setShowAll] = React.useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0, above: false });
  const [inheritedFont, setInheritedFont] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const updatePosition = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      above: false,
    });
    const computed = window.getComputedStyle(el);
    setInheritedFont(computed.fontFamily);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayOptions = React.useMemo(() => {
    if (showAll || !inputValue) return options;
    const lower = inputValue.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, inputValue, showAll]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setInputValue(next);
    setShowAll(false);
    onChange(next);
    if (!open) setOpen(true);
  }

  function handleSelect(opt: string) {
    setInputValue(opt);
    onChange(opt);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleFocus() {
    if (options.length > 0) {
      setShowAll(true);
      updatePosition();
      setOpen(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        data-slot="input"
        className={cn(
          "border-input placeholder:text-muted-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      {open && displayOptions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          data-slot="combobox-dropdown"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: Math.min(200, window.innerHeight - pos.top - 8),
            zIndex: 9999,
            fontFamily: inheritedFont,
          }}
          className="overflow-y-auto rounded-md border border-cc-border bg-cc-surface-1 text-cc-text shadow-md"
        >
          <div className="p-1">
            {displayOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none hover:bg-cc-surface-3 text-cc-text"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
              >
                {opt}
                {value === opt && (
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export { ComboboxInput }
