import os
import glob
from PIL import Image

input_dir = 'content-automation/raw_assets'
output_dir = 'content-automation/processed_assets'

os.makedirs(output_dir, exist_ok=True)

def remove_green_background(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        # item is (R, G, B, A)
        r, g, b, a = item
        
        # 초록색 배경 판별 조건 (크로마키 초록색: G가 높고 R, B가 상대적으로 낮음)
        # 나노바나나나 일반적인 툴에서 사용하는 초록색에 맞춤
        if g > 120 and r < g * 0.7 and b < g * 0.7:
            # 배경을 투명하게 (Alpha = 0)
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(out_path, "PNG")
    print(f"✅ 처리 완료: {os.path.basename(img_path)}")

# 대상 파일 찾기
image_files = glob.glob(os.path.join(input_dir, '*.png'))

if not image_files:
    print("❌ raw_assets 폴더에 png 파일이 없습니다.")
else:
    print(f"총 {len(image_files)}개의 이미지 변환을 시작합니다...")
    for file in image_files:
        filename = os.path.basename(file)
        out_file = os.path.join(output_dir, filename)
        remove_green_background(file, out_file)
    print(f"\n🎉 모든 작업이 완료되었습니다! 확인 경로: {output_dir}")
