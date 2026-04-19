import React, { useState } from "react";

/**
 * SearchBar 컴포넌트
 *
 * @param {string[]} categories  - 드롭다운 카테고리 목록
 * @param {string}   placeholder - 입력창 placeholder
 * @param {function} onSearch    - 검색 핸들러 (query, category) => void
 */
export default function SearchBar({
  categories = ["중고거래", "부동산", "알바", "중고차"],
  placeholder = "검색어를 입력해주세요",
  onSearch,
}) {
  const [category, setCategory] = useState(categories[0]);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSearch = () => {
    if (onSearch) onSearch(query, category);
  };

  const wrapStyle = {
    display: "flex",
    alignItems: "center",
    height: "50px",
    border: "1px solid var(--color-border-default)",
    borderRadius: "9999px",
    background: "var(--color-background-primary)",
    overflow: "hidden",
    width: "100%",
    boxSizing: "border-box",
    padding: "1px 1px 1px 21px",
  };

  const dropdownStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    paddingRight: "10px",
    borderRight: "1px solid var(--color-border-default)",
    cursor: "pointer",
    flexShrink: 0,
  };

  const dropdownTextStyle = {
    fontFamily: "var(--font-family-base)",
    fontSize: "var(--type-size-16)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-text-secondary)",
    whiteSpace: "nowrap",
  };

  const inputStyle = {
    flex: 1,
    border: "none",
    outline: "none",
    fontFamily: "var(--font-family-base)",
    fontSize: "var(--type-size-16)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--color-text-primary)",
    padding: "0 16px",
    background: "transparent",
  };

  const searchBtnStyle = {
    width: "28px",
    height: "28px",
    borderRadius: "9999px",
    background: "var(--color-text-primary)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: "10px",
    fontSize: "14px",
    color: "var(--color-background-primary)",
  };

  const dropdownMenuStyle = {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    background: "var(--color-background-primary)",
    border: "1px solid var(--color-border-default)",
    borderRadius: "8px",
    overflow: "hidden",
    zIndex: 10,
    minWidth: "120px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  };

  const dropdownItemStyle = (active) => ({
    padding: "10px 16px",
    fontFamily: "var(--font-family-base)",
    fontSize: "var(--type-size-14)",
    fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-regular)",
    color: active ? "var(--color-brand-primary)" : "var(--color-text-primary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: active ? "#fff5ef" : "transparent",
  });

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={wrapStyle}>
        {/* Dropdown */}
        <div style={dropdownStyle} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <span style={dropdownTextStyle}>{category}</span>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>▾</span>
          {dropdownOpen && (
            <div style={dropdownMenuStyle}>
              {categories.map((c) => (
                <div
                  key={c}
                  style={dropdownItemStyle(c === category)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCategory(c);
                    setDropdownOpen(false);
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={placeholder}
          style={{
            ...inputStyle,
            "::placeholder": { color: "var(--color-text-placeholder)" },
          }}
        />

        {/* Search button */}
        <button style={searchBtnStyle} onClick={handleSearch}>
          🔍
        </button>
      </div>
    </div>
  );
}
