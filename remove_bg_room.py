import os
import glob

input_dir = 'content-automation/raw_assets'
output_dir = 'content-automation/processed_assets'

os.makedirs(output_dir, exist_ok=True)

# Gemini_Generated_Image 로 시작하는 파일 찾기
image_files = glob.glob(os.path.join(input_dir, 'Gemini*.png'))
if not image_files:
    print("❌ raw_assets 폴더에 Gemini 이미지 파일이 없습니다.")
    exit(0)

print(f"총 {len(image_files)}개의 방 이미지 배경 제거를 시작합니다 (rembg AI 모델 사용)...")

import cv2
import numpy as np
from rembg import remove
from PIL import Image

for file in image_files:
    try:
        # rembg로 배경 완벽 제거
        input_image = Image.open(file)
        output_image = remove(input_image)
        
        out_file = os.path.join(output_dir, os.path.basename(file))
        output_image.save(out_file)
        print(f"✅ 처리 완료: {os.path.basename(file)}")
    except Exception as e:
        print(f"❌ 에러 발생 ({os.path.basename(file)}): {e}")

print(f"\n🎉 사무실 방 이미지 배경이 모두 투명하게 처리되었습니다: {output_dir}")
