from PIL import Image
import numpy as np

img = Image.open('content-automation/processed_assets/방 구조.png').convert('RGB')
# Resize it to a small grid to see what it looks like, or just print its shape
print(f"Shape: {img.size}")

# Let's try to detect the walls by finding the dark pixels or specific colors
img.thumbnail((40, 40)) # scale down to roughly match the tile grid
arr = np.array(img)
for r in range(arr.shape[0]):
    row_str = ""
    for c in range(arr.shape[1]):
        # if dark, it's a wall?
        if arr[r, c].mean() < 100:
            row_str += "XX"
        else:
            row_str += ".."
    print(row_str)
