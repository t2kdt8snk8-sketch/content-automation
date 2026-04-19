import cv2
import numpy as np
import glob
import os

input_dir = 'content-automation/raw_assets'
output_dir = 'content-automation/processed_assets'

os.makedirs(output_dir, exist_ok=True)

image_files = glob.glob(os.path.join(input_dir, '*.png'))
if not image_files:
    print("❌ raw_assets 폴더에 png 파일이 없습니다.")
    exit(0)

print(f"총 {len(image_files)}개의 이미지 정밀 변환을 시작합니다...")

for file in image_files:
    # 1. 이미지 읽기 (알파 채널 포함)
    img = cv2.imread(file, cv2.IMREAD_UNCHANGED)
    if img is None:
        continue
    
    # 2. BGR 채널 분리
    if img.shape[2] == 4:
        b, g, r, a = cv2.split(img)
        rgb = cv2.merge((b, g, r))
    else:
        rgb = img
        a = np.ones(rgb.shape[:2], dtype=np.uint8) * 255
        
    # 3. HSV 색상 공간으로 변환 (색상 판별에 훨씬 유리함)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_BGR2HSV)
    
    # 4. 초록색 영역 지정 (OpenCV에서 Hue는 0~179)
    # 연두색부터 짙은 초록색, 그림자진 초록색까지 넓게 포괄
    lower_green = np.array([30, 30, 30])
    upper_green = np.array([90, 255, 255])
    
    # 5. 초록색 마스크 생성
    mask = cv2.inRange(hsv, lower_green, upper_green)
    
    # 6. 마스크 약간 확장(다일레이션) 및 부드럽게(블러) 처리하여 테두리에 남은 초록색 찌꺼기 제거
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    mask = cv2.GaussianBlur(mask, (3,3), 0)
    
    # 7. 마스크 반전 (초록색이 아닌 부분 = 남길 부분)
    mask_inv = 255 - mask
    
    # 8. 원본 알파 채널과 결합
    # 기존 알파 채널과 새로운 마스크의 최소값을 취해, 이미 투명했던 부분도 유지
    new_a = cv2.bitwise_and(a, mask_inv)
    
    # 9. 최종 이미지 저장
    b, g, r = cv2.split(rgb)
    final = cv2.merge((b, g, r, new_a))
    
    out_file = os.path.join(output_dir, os.path.basename(file))
    cv2.imwrite(out_file, final)
    print(f"✅ 처리 완료: {os.path.basename(file)}")

print(f"\n🎉 완벽하게 테두리까지 지워진 파일들이 저장되었습니다: {output_dir}")
