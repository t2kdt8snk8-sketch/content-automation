/**
 * Image Processor — Canvas-based image analysis for local fallback
 * Extracts color grid from uploaded images
 */

/**
 * Load an image file and return an HTMLImageElement
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        const url = URL.createObjectURL(file);
        img.src = url;
    });
}

/**
 * Extract a color grid from an image
 * Downscales the image to gridWidth × gridHeight and returns average colors
 *
 * @param {HTMLImageElement} img
 * @param {number} gridWidth - Number of columns
 * @param {number} gridHeight - Number of rows (auto-calculated if 0)
 * @returns {{ colorGrid: number[][][], actualWidth: number, actualHeight: number }}
 */
export function extractColorGrid(img, gridWidth = 64, gridHeight = 0) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Calculate grid height to maintain aspect ratio
    const aspect = img.height / img.width;
    const actualHeight = gridHeight > 0 ? gridHeight : Math.round(gridWidth * aspect);
    const actualWidth = gridWidth;

    // Draw image at full resolution for accurate sampling
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    // Size of each cell in source image pixels
    const cellW = img.width / actualWidth;
    const cellH = img.height / actualHeight;

    const colorGrid = [];

    for (let row = 0; row < actualHeight; row++) {
        const rowColors = [];
        for (let col = 0; col < actualWidth; col++) {
            // Sample area bounds
            const x0 = Math.floor(col * cellW);
            const y0 = Math.floor(row * cellH);
            const x1 = Math.floor((col + 1) * cellW);
            const y1 = Math.floor((row + 1) * cellH);

            let rSum = 0, gSum = 0, bSum = 0, count = 0;

            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const idx = (y * img.width + x) * 4;
                    rSum += pixels[idx];
                    gSum += pixels[idx + 1];
                    bSum += pixels[idx + 2];
                    count++;
                }
            }

            rowColors.push([
                Math.round(rSum / count),
                Math.round(gSum / count),
                Math.round(bSum / count),
            ]);
        }
        colorGrid.push(rowColors);
    }

    return { colorGrid, actualWidth, actualHeight };
}

/**
 * Generate a thumbnail data URL for preview
 * @param {HTMLImageElement} img
 * @param {number} maxSize
 * @returns {string} data URL
 */
export function generateThumbnail(img, maxSize = 400) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let w = img.width, h = img.height;
    if (w > h) {
        if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
    } else {
        if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Convert an image file to base64 string
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
