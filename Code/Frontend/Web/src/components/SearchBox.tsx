"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  SEARCH_ITEMS,
  scoreItem,
  zoneSearchItems,
  type SearchItem,
  type SearchPageKey,
  type SearchZone,
} from "../lib/search";
import { zoneHref } from "../lib/zone-link";
import {
  ArrowRightIcon,
  ChartIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  GaugeIcon,
  GridIcon,
  SearchIcon,
} from "./icons";

const PAGES: Record<SearchPageKey, { label: string; path: string; Icon: typeof GridIcon }> = {
  overview: { label: "Tổng quan", path: "/", Icon: GridIcon },
  analysis: { label: "Phân tích", path: "/analysis", Icon: GaugeIcon },
  history: { label: "Lịch sử", path: "/history", Icon: ChartIcon },
  activity: { label: "Nhật ký", path: "/activity", Icon: ClockIcon },
  garden: { label: "Khu vườn", path: "/garden", Icon: EditIcon },
};

const PAGE_ORDER: SearchPageKey[] = ["overview", "analysis", "history", "activity", "garden"];
const RECENT_KEY = "greenflow:search-recent";
const RECENT_LIMIT = 5;

type RecentItem = {
  key: string;
  label: string;
  hint: string;
  page: SearchPageKey;
  href: string;
  zoneId?: string;
};

function RowBody({
  Icon,
  label,
  hint,
  chip,
}: {
  Icon: typeof GridIcon;
  label: string;
  hint: string;
  chip?: string;
}) {
  return (
    <>
      <span className="search-item-icon">
        <Icon size={15} />
      </span>
      <span className="search-item-text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      {chip ? (
        <span className="search-page-chip">{chip}</span>
      ) : (
        <ArrowRightIcon size={13} className="search-arrow" />
      )}
    </>
  );
}

function readRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentItem[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
  } catch {
    // Trình duyệt chặn localStorage thì chỉ mất lịch sử gợi ý, không ảnh hưởng tìm kiếm.
  }
}

export function SearchBox({
  active,
  zones = [],
  onNavigate,
  onSelectZone,
}: {
  active: SearchPageKey;
  zones?: SearchZone[];
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onSelectZone?: (zoneId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<RecentItem[]>(readRecent);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => [...SEARCH_ITEMS, ...(onSelectZone ? zoneSearchItems(zones, active) : [])],
    [active, onSelectZone, zones],
  );

  const groups = useMemo(() => {
    if (!term.trim()) return [];
    const scored = items
      .map((item) => ({ item, score: scoreItem(item, term) }))
      .filter((entry) => entry.score > 0);

    return PAGE_ORDER.map((page) => ({
      page,
      entries: scored
        .filter((entry) => entry.item.page === page)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item),
    })).filter((group) => group.entries.length > 0);
  }, [items, term]);

  const flat = useMemo(() => groups.flatMap((group) => group.entries), [groups]);
  const flatIndex = useMemo(
    () => new Map(flat.map((item, index) => [item.id, index])),
    [flat],
  );
  const showRecent = term.trim() === "";

  const openSearch = useCallback(() => {
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeSearch = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const resolveHref = (item: SearchItem) =>
    item.zoneId ? zoneHref("/", item.zoneId) : PAGES[item.page].path;

  const pushRecent = (entry: RecentItem) => {
    const next = [entry, ...recent.filter((item) => item.key !== entry.key)].slice(
      0,
      RECENT_LIMIT,
    );
    setRecent(next);
    saveRecent(next);
  };

  const handlePick = (item: SearchItem, event: MouseEvent<HTMLAnchorElement>) => {
    pushRecent({
      key: item.id,
      label: item.label,
      hint: item.hint,
      page: item.page,
      href: resolveHref(item),
    });
    closeSearch();
    setTerm("");
    onNavigate?.(event);
  };

  const handlePickRecent = (entry: RecentItem, event: MouseEvent<HTMLAnchorElement>) => {
    pushRecent(entry);
    closeSearch();
    setTerm("");
    onNavigate?.(event);
  };

  const pickZone = (item: SearchItem) => {
    if (!item.zoneId || !onSelectZone) return;
    pushRecent({
      key: item.id,
      label: item.label,
      hint: item.hint,
      page: item.page,
      href: resolveHref(item),
      zoneId: item.zoneId,
    });
    closeSearch();
    setTerm("");
    onSelectZone(item.zoneId);
  };

  const pickRecentZone = (entry: RecentItem) => {
    if (!entry.zoneId || !onSelectZone) return;
    pushRecent(entry);
    closeSearch();
    setTerm("");
    onSelectZone(entry.zoneId);
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecent([]);
    setActiveIndex(-1);
  };

  const move = (next: number) => {
    setActiveIndex(next);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`gf-search-option-${next}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const submitActive = () => {
    const list = showRecent ? recent : flat;
    if (!list.length) return;
    const index = activeIndex >= 0 && activeIndex < list.length ? activeIndex : 0;
    document.getElementById(`gf-search-option-${index}`)?.click();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitActive();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = showRecent ? recent.length : flat.length;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openSearch();
      if (count > 0) move(activeIndex >= count - 1 ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count > 0) move(activeIndex <= 0 ? count - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      submitActive();
    } else if (event.key === "Escape") {
      closeSearch();
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openSearch]);

  return (
    <div className={`topbar-search ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="topbar-search-trigger"
        aria-label="Mở tìm kiếm"
        aria-expanded={open}
        onClick={openSearch}
      >
        <SearchIcon size={17} />
      </button>

      <form className="topbar-search-field" role="search" onSubmit={handleSubmit}>
        <SearchIcon size={15} className="topbar-search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={term}
          placeholder="Tìm trong Greenflow…"
          aria-label="Tìm kiếm trong Greenflow"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setTerm(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {term ? (
          <button
            type="button"
            className="topbar-search-clear"
            aria-label="Xóa từ khóa"
            onClick={() => {
              setTerm("");
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <CloseIcon size={13} />
          </button>
        ) : (
          <kbd className="topbar-search-kbd">/</kbd>
        )}
        <button
          type="button"
          className="topbar-search-close"
          aria-label="Đóng tìm kiếm"
          onClick={closeSearch}
        >
          Hủy
        </button>
      </form>

      {open && (
        <div className="search-panel" id="gf-search-panel" aria-label="Kết quả tìm kiếm">
          {showRecent ? (
            recent.length > 0 ? (
              <section className="search-group">
                <header className="search-group-head">
                  <span>Gần đây</span>
                  <button type="button" className="search-clear-recent" onClick={clearRecent}>
                    Xóa
                  </button>
                </header>
                <ul>
                  {recent.map((entry, index) => {
                    const { Icon, label } = PAGES[entry.page];
                    const body = (
                      <RowBody Icon={Icon} label={entry.label} hint={entry.hint} chip={label} />
                    );
                    return (
                      <li key={entry.key}>
                        {entry.zoneId && onSelectZone ? (
                          <button
                            type="button"
                            id={`gf-search-option-${index}`}
                            className={index === activeIndex ? "active" : ""}
                            onClick={() => pickRecentZone(entry)}
                          >
                            {body}
                          </button>
                        ) : (
                          <Link
                            id={`gf-search-option-${index}`}
                            href={entry.href}
                            className={index === activeIndex ? "active" : ""}
                            onClick={(event) => handlePickRecent(entry, event)}
                          >
                            {body}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <p className="search-empty-note">
                Gõ tên tính năng, ô trồng hoặc từ khóa như “bơm”, “bồn nước”.
              </p>
            )
          ) : groups.length > 0 ? (
            groups.map((group) => {
              const { Icon, label } = PAGES[group.page];
              return (
                <section className="search-group" key={group.page}>
                  <header className="search-group-head">
                    <span>
                      <Icon size={12} />
                      {label}
                    </span>
                    {group.page === active && <em className="search-current">Đang xem</em>}
                    <small>{group.entries.length}</small>
                  </header>
                  <ul>
                    {group.entries.map((item) => {
                      const index = flatIndex.get(item.id) ?? 0;
                      const body = <RowBody Icon={Icon} label={item.label} hint={item.hint} />;
                      return (
                        <li key={item.id}>
                          {item.zoneId && onSelectZone ? (
                            <button
                              type="button"
                              id={`gf-search-option-${index}`}
                              className={index === activeIndex ? "active" : ""}
                              onClick={() => pickZone(item)}
                            >
                              {body}
                            </button>
                          ) : (
                            <Link
                              id={`gf-search-option-${index}`}
                              href={resolveHref(item)}
                              className={index === activeIndex ? "active" : ""}
                              onClick={(event) => handlePick(item, event)}
                            >
                              {body}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          ) : (
            <div className="search-empty">
              <p>Không tìm thấy “{term.trim()}”.</p>
              <div className="search-suggestions">
                {["bơm", "bồn nước", "độ ẩm", "nhật ký"].map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => {
                      setTerm(word);
                      setActiveIndex(-1);
                      inputRef.current?.focus();
                    }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="search-foot">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> để chọn
            </span>
            <span>
              <kbd>Enter</kbd> để mở
            </span>
            <span>
              <kbd>Esc</kbd> để đóng
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
