import React, { useEffect, useRef } from "react";
export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    resources: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
    sync: "M3 7h17m-4-4 4 4-4 4M21 17H4m4 4-4-4 4-4",
    contribute: "M5 19 19 5M5 5h14v14",
    setup: "M12 5v14M5 12h14",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.resources} />
    </svg>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const background = document.querySelector<HTMLElement>(".app");
    background?.setAttribute("inert", "");
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        e.preventDefault();
        ref.current?.focus();
        return;
      }
      if (!ref.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      background?.removeAttribute("inert");
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sectionheading">
          <h2>{title}</h2>
          <button aria-label="关闭详情" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export const labels: Record<string, string> = {
  skills: "技能",
  rules: "规则",
  mcp: "MCP 服务",
  docs: "文档",
  agents: "AI 助手",
  config: "团队配置",
  new: "新增",
  modified: "修改",
  deleted: "删除",
  current: "已核对部署",
  pending: "待同步或核对",
  local: "本地资源",
  unknown: "部署待核对",
};
