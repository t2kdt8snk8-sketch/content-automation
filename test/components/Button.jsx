import React from "react";

/**
 * Button 컴포넌트
 *
 * @param {string}  label          - 버튼 텍스트 (기본값: "앱 다운로드")
 * @param {"primary"|"secondary"|"ghost"} variant - 버튼 스타일 변형
 * @param {React.ReactNode} icon   - 아이콘 노드 (없으면 null)
 * @param {"left"|"right"} iconPosition - 아이콘 위치
 * @param {boolean} disabled       - 비활성화 여부
 * @param {function} onClick       - 클릭 핸들러
 * @param {string}  className      - 추가 클래스
 */

const variantStyles = {
  primary: {
    background: "var(--color-brand-primary)",
    color: "var(--color-background-primary)",
    border: "none",
  },
  secondary: {
    background: "var(--color-background-primary)",
    color: "var(--color-brand-primary)",
    border: "1.5px solid var(--color-brand-primary)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-primary)",
    border: "none",
  },
};

const disabledStyle = {
  background: "var(--color-background-secondary)",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border-default)",
  cursor: "not-allowed",
  opacity: 0.5,
};

export default function Button({
  label = "앱 다운로드",
  variant = "primary",
  icon = null,
  iconPosition = "left",
  disabled = false,
  onClick,
  className = "",
}) {
  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "32px",
    padding: "0 12px",
    borderRadius: "4px",
    fontFamily: "var(--font-family-base)",
    fontSize: "var(--type-size-14)",
    fontWeight: "var(--font-weight-semibold)",
    lineHeight: "var(--type-line-height-20)",
    letterSpacing: "var(--type-letter-spacing-0)",
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    boxSizing: "border-box",
    ...(disabled ? disabledStyle : variantStyles[variant]),
  };

  return (
    <button
      style={style}
      disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      className={className}
    >
      {icon && iconPosition === "left" && (
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      )}
      <span>{label}</span>
      {icon && iconPosition === "right" && (
        <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      )}
    </button>
  );
}
