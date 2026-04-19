import os
import glob
from PIL import Image
from rembg import remove

processed_dir = 'content-automation/processed_assets'
raw_dir = 'content-automation/raw_assets'

processed_files = glob.glob(os.path.join(processed_dir, '*.png'))
raw_files = glob.glob(os.path.join(raw_dir, 'Slice *.png'))

print("원본 파일 크기 분석 중...")
raw_sizes = {}
for r in raw_files:
    with Image.open(r) as img:
        raw_sizes[r] = img.size

print("\n이름이 변경된 에셋들에 대해 AI 배경 제거(rembg)를 다시 적용하여 초록색 식물을 복원합니다...")

for p in processed_files:
    filename = os.path.basename(p)
    # 이름이 바뀌지 않은 Slice 파일이나 방(Gemini) 파일은 건너뜁니다
    if filename.startswith('Slice') or filename.startswith('Gemini'):
        continue
        
    with Image.open(p) as img:
        psize = img.size
        
    matches = [r for r, size in raw_sizes.items() if size == psize]
    
    if len(matches) == 1:
        raw_file = matches[0]
        print(f"✅ 매칭 성공: '{filename}' (원본: {os.path.basename(raw_file)}) -> AI 배경 제거 중...")
        try:
            with open(raw_file, 'rb') as i:
                input_data = i.read()
                output_data = remove(input_data)
                with open(p, 'wb') as o:
                    o.write(output_data)
            print(f"   -> 식물 복원 완료!")
        except Exception as e:
            print(f"   -> 오류 발생: {e}")
    elif len(matches) > 1:
        print(f"⚠️ 매칭 주의: '{filename}'와 크기가 같은 원본이 {len(matches)}개 있습니다. (수동 확인 필요)")
    else:
        print(f"❌ 매칭 실패: '{filename}'의 원본을 찾을 수 없습니다.")

print("\n🎉 모든 복원 작업이 완료되었습니다!")
