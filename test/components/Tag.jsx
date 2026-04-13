import React from "react";

/**
 * Tag 컴포넌트
 *
 * @param {string}  label     - 태그 텍스트 (기본값: "송도동")
 * @param {React.ReactNode} icon - 아이콘 노드 (없으면 null)
 * @param {boolean} selected  - 선택 상태
 * @param {boolean} disabled  - 비활성화 여부
 * @param {function} onClick  - 클릭 핸들러
 * @param {string}  className - 추가 클래스
 */

export default function Tag({
  label = "송도동",
  icon = null,
  selected = false,
  disabled = false,
  onClick,
  className = "",
}) {
  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    height: "40px",
    padding: "0 14px",
    borderRadius: "9999px",
    fontFamily: "var(--font-family-base)",
    fontSize: "var(--type-size-14)",
    fontWeight: "var(--font-weight-semibold)",
    lineHeight: "var(--type-line-height-20)",
    letterSpacing: "var(--type-letter-spacing-0)",
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
    boxSizing: "border-box",
    // variant 분기
    background: disabled
      ? "var(--color-background-secondary)"
      : selected
      ? "var(--color-brand-primary)"
      : "var(--color-background-primary)",
    color: disabled
      ? "var(--color-text-secondary)"
      : selected
      ? "var(--color-background-primary)"
      : "var(--color-text-primary)",
    border: selected
      ? "1.5px solid var(--color-brand-primary)"
      : "1px solid var(--color-border-default)",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      style={style}
      disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      className={className}
    >
      {icon && (
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
