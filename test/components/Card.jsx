import React from "react";

/**
 * Card 컴포넌트
 *
 * @param {string} label      - 카테고리 이름
 * @param {string} icon       - 이모지 아이콘
 * @param {function} onClick  - 클릭 핸들러
 * @param {string} className  - 추가 클래스
 */
export default function Card({
  label = "중고거래",
  icon = "🛒",
  onClick,
  className = "",
}) {
  const style = {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    padding: "12px 16px",
    background: "var(--color-background-primary)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={style}
      onClick={onClick}
      className={className}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <span style={{ fontSize: "24px", lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontFamily: "var(--font-family-base)",
          fontSize: "var(--type-size-16)",
          fontWeight: "var(--font-weight-semibold)",
          lineHeight: "var(--type-line-height-24)",
          color: "var(--color-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
