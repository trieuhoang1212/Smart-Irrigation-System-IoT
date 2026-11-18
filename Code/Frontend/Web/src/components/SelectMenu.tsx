"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type SelectOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 208;
const MENU_MAX_HEIGHT = 300;

type SelectMenuProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
}: SelectMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `${useId()}-menu`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || disabled) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, MENU_MIN_WIDTH),
      window.innerWidth - 16,
    );
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - 8;
    const spaceAbove = rect.top - MENU_GAP - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;

    setPosition(
      openUp
        ? {
            left,
            width,
            maxHeight: Math.min(MENU_MAX_HEIGHT, spaceAbove),
            bottom: window.innerHeight - rect.top + MENU_GAP,
          }
        : {
            left,
            width,
            maxHeight: Math.min(MENU_MAX_HEIGHT, spaceBelow),
            top: rect.bottom + MENU_GAP,
          },
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && option.value !== value) onChange(option.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange, options, value],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnViewportChange = (event: Event) => {
      // Menu tự cuộn bên trong thì giữ mở; trang cuộn thì đóng để không lệch nút.
      if (
        menuRef.current &&
        event.target instanceof Node &&
        menuRef.current.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${menuId}-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, menuId, open]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      default:
        break;
    }
  };

  const menuStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        ...(position.top !== undefined ? { top: position.top } : {}),
        ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
      }
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={`select-menu-trigger ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-menu-value">{selected?.label ?? ""}</span>
        <ChevronDownIcon size={14} className="select-menu-caret" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="select-menu-pop"
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${menuId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={[
                  "select-menu-option",
                  index === activeIndex ? "is-active" : "",
                  option.value === value ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
              >
                <span className="select-menu-label">{option.label}</span>
                {option.value === value && <CheckIcon size={13} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
