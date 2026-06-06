"use client";

import { useState } from "react";

export type CodeTab = {
  label: string;
  lang: string;
  code: string;
};

export function CodeTabs({ tabs, ariaLabel }: { tabs: CodeTab[]; ariaLabel?: string }) {
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0];

  return (
    <div className="rounded-md border border-zinc-800 overflow-hidden">
      <div
        role="tablist"
        aria-label={ariaLabel ?? "ตัวอย่างโค้ด"}
        className="flex bg-zinc-950 border-b border-zinc-800 text-xs"
      >
        {tabs.map((tab, idx) => {
          const selected = idx === active;
          return (
            <button
              key={tab.label}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(idx)}
              className={
                "px-3 py-2 font-medium transition-colors border-r border-zinc-800 " +
                (selected
                  ? "text-white bg-zinc-900"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <pre
        className="bg-zinc-900 text-zinc-100 p-4 text-xs overflow-x-auto leading-relaxed"
        data-lang={current.lang}
      >
        <code data-lang={current.lang}>{current.code}</code>
      </pre>
    </div>
  );
}
