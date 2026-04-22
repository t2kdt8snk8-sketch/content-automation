#!/usr/bin/env python3
"""
픽셀 오피스 에셋 리사이즈 스크립트
processed_assets/ 이미지를 목표 픽셀 크기로 nearest-neighbor 리사이즈 후
web/frontend/public/assets/furniture/ 에 배치한다.
"""
import os
import unicodedata
from PIL import Image

ASSETS_DIR = "content-automation/processed_assets"
DEST_DIR = "web/frontend/public/assets/furniture"

# (원본 파일명(또는 후보 파일명 리스트), 목적지 폴더명, 목적지 파일명, 목표 width px, 목표 height px)
MAPPINGS = [
    # 기존 ID 교체
    ("화이트보드.png",              "WHITEBOARD",       "WHITEBOARD.png",       96, 64),
    ("사장 책상.png",               "DESK",             "DESK_FRONT.png",       80, 48),
    ("모니터, 마우스, 키보드.png",   "PC",               "PC_FRONT_OFF.png",     48, 48),
    ("모니터, 마우스, 키보드.png",   "PC_REVERSED",      "PC_REVERSED.png",      48, 48),
    ("커피머신.png",                "COFFEE",           "COFFEE.png",           32, 48),
    ("의자.png",                    "CUSHIONED_CHAIR",  "CUSHIONED_CHAIR_FRONT.png", 32, 32),
    ("의자.png",                    "CUSHIONED_CHAIR",  "CUSHIONED_CHAIR_BACK.png",  32, 32),
    ("의자.png",                    "CUSHIONED_CHAIR",  "CUSHIONED_CHAIR_SIDE.png",  16, 16),
    ("의자.png",                    "CHAIR_REVERSED",   "CHAIR_REVERSED.png",        32, 32),
    ("의자 앞쪽.png",                "CHAIR_FRONT_CLEAN","CHAIR_FRONT_CLEAN.png",     32, 32),
    ("그림.png",                    "LARGE_PAINTING",   "LARGE_PAINTING.png",   64, 48),
    ("그림2.png",                   "SMALL_PAINTING",   "SMALL_PAINTING.png",   48, 48),
    ("식물1.png",                   "PLANT",            "PLANT.png",            32, 64),
    ("식물2.png",                   "PLANT_2",          "PLANT_2.png",          32, 64),
    ("식물3.png",                   "LARGE_PLANT",      "LARGE_PLANT.png",      32, 48),
    ("식물4.png",                   "POT",              "POT.png",              32, 64),
    ("식물5.png",                   "CACTUS",           "CACTUS.png",           32, 48),
    ("식물6.png",                   "HANGING_PLANT",    "HANGING_PLANT.png",    32, 64),
    # 신규 ID
    ("정수기.png",                  "WATER_DISPENSER",  "WATER_DISPENSER.png",  32, 64),
    ("로봇청소기.png",              "ROBOT_VACUUM",     "ROBOT_VACUUM.png",     32, 32),
    ("오른쪽 방 테이블.png",         "BOSS_MONITOR",     "BOSS_MONITOR.png",     48, 80),
    ("사장 모니터.png",              "BOSS_MONITOR_NEW", "BOSS_MONITOR_NEW.png", 64, 32),
    (("왼쪽방 데스크 1.png", "왼쪽방 데스크.png", "왼쪽방 테이블.png"), "SERVER_RACK", "SERVER_RACK.png", 32, 64),
    ("사장 의자 1.png",              "BOSS_CHAIR",       "BOSS_CHAIR.png",       32, 48),
    ("Slice 51.png",                "SOFA_SLICE_51",    "SOFA_SLICE_51.png",    64, 48),
    ("Slice 54 1.png",              "SLICE_54_1",       "SLICE_54_1_v2.png",    80, 80),
    ("그래프 차트1(창문에 붙일 것).png",             "CHART_1",          "CHART_1.png",          64, 64),
    ("그래프 차트2 (창문에 붙일 것).png",             "CHART_2",          "CHART_2.png",          96, 64),
    ("그래프 차트 3(창문에 붙일 것).png",             "CHART_3",          "CHART_3.png",          64, 64),
]


def resolve_source_path(src_names) -> str | None:
    """Resolve source path with candidate fallback + Unicode normalization (NFC/NFD)."""
    if isinstance(src_names, str):
        candidates = [src_names]
    else:
        candidates = list(src_names)

    normalized_files = {
        unicodedata.normalize("NFC", filename): filename for filename in os.listdir(ASSETS_DIR)
    }
    for src_name in candidates:
        exact = os.path.join(ASSETS_DIR, src_name)
        if os.path.exists(exact):
            return exact
        target_nfc = unicodedata.normalize("NFC", src_name)
        matched = normalized_files.get(target_nfc)
        if matched:
            return os.path.join(ASSETS_DIR, matched)
    return None

def remove_green_background(img: Image.Image) -> Image.Image:
    """Chroma-key style green removal for assets exported on green background."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # Robust green-screen detection: green channel dominance + minimum brightness.
            if g >= 85 and (g - r) >= 18 and (g - b) >= 18:
                px[x, y] = (r, g, b, 0)
    return rgba

def resize_contain_bottom(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Keep source aspect ratio, fit inside target box, bottom-align on transparent canvas."""
    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        return img.resize((target_w, target_h), Image.NEAREST)

    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = img.resize((new_w, new_h), Image.NEAREST)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - new_w) // 2
    y = target_h - new_h
    canvas.paste(resized, (x, y), resized)
    return canvas

def resize_contain_bottom_hq(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """High-quality variant for non-pixel-art chair sources."""
    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        return img.resize((target_w, target_h), Image.LANCZOS)

    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - new_w) // 2
    y = target_h - new_h
    canvas.paste(resized, (x, y), resized)
    return canvas

def remove_top_portion_alpha(img: Image.Image, ratio: float) -> Image.Image:
    """Remove opaque pixels from the top portion (used for monitor portrait leftovers)."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    cut_y = max(0, min(h, int(round(h * ratio))))
    for y in range(cut_y):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (r, g, b, 0)
    return rgba

def clear_top_center_patch(img: Image.Image, top_ratio: float, center_ratio: float) -> Image.Image:
    """Clear top-center region on already resized output (artifact cleanup)."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    cut_y = max(0, min(h, int(round(h * top_ratio))))
    half_center = int(round((w * center_ratio) / 2))
    cx = w // 2
    x0 = max(0, cx - half_center)
    x1 = min(w, cx + half_center)
    for y in range(cut_y):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (r, g, b, 0)
    return rgba

def trim_transparent_bounds(img: Image.Image) -> Image.Image:
    """Trim fully transparent padding while preserving RGBA."""
    bbox = img.getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def resize_and_copy(src_name, dest_folder, dest_file, target_w, target_h):
    src_path = resolve_source_path(src_name)
    dest_dir = os.path.join(DEST_DIR, dest_folder)
    dest_path = os.path.join(dest_dir, dest_file)

    if src_path is None:
        if isinstance(src_name, str):
            miss = os.path.join(ASSETS_DIR, src_name)
        else:
            miss = " | ".join(os.path.join(ASSETS_DIR, s) for s in src_name)
        print(f"  [SKIP] 원본 없음: {miss}")
        return False

    os.makedirs(dest_dir, exist_ok=True)

    img = Image.open(src_path).convert("RGBA")
    source_basename = os.path.basename(src_path)
    source_basename_nfc = unicodedata.normalize("NFC", source_basename)
    if source_basename_nfc in {"왼쪽방 테이블.png", "왼쪽방 데스크.png", "왼쪽방 데스크 1.png", "의자 앞쪽.png"}:
        img = remove_green_background(img)
    if dest_folder in {"CHAIR_REVERSED", "PC_REVERSED"}:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if dest_folder == "SERVER_RACK":
        # This source frequently has very large transparent margins.
        img = trim_transparent_bounds(img)
    if dest_folder == "BOSS_MONITOR_NEW":
        # Remove remaining top portrait area (tie/suit) from this source.
        img = remove_top_portion_alpha(img, 0.15)

    # Some assets are sensitive to distortion; preserve aspect ratio.
    if dest_folder in {"CUSHIONED_CHAIR", "CHAIR_REVERSED", "CHAIR_FRONT_CLEAN"}:
        resized = resize_contain_bottom_hq(img, target_w, target_h)
    elif dest_folder in {"BOSS_CHAIR", "SERVER_RACK"}:
        resized = resize_contain_bottom(img, target_w, target_h)
    else:
        resized = img.resize((target_w, target_h), Image.NEAREST)

    if dest_folder == "BOSS_MONITOR_NEW":
        # Final pass to remove tiny portrait remnants after downscale.
        resized = clear_top_center_patch(resized, top_ratio=0.19, center_ratio=0.31)
    resized.save(dest_path, "PNG")

    actual_w, actual_h = resized.size
    print(f"  [OK] {source_basename} → {dest_folder}/{dest_file} ({actual_w}×{actual_h}px)")
    return True

def main():
    ok_count = 0
    skip_count = 0
    for (src, folder, fname, w, h) in MAPPINGS:
        success = resize_and_copy(src, folder, fname, w, h)
        if success:
            ok_count += 1
        else:
            skip_count += 1

    print(f"\n완료: {ok_count}개 처리, {skip_count}개 건너뜀")
    if skip_count > 0:
        print("⚠️  건너뜀 항목이 있음. processed_assets/ 파일명 확인 필요.")

if __name__ == "__main__":
    main()
