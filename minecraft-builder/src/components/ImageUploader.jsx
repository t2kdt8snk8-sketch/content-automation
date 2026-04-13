import { useState, useRef, useCallback } from 'react';

function ImageUploader({ onImageSelect, preview, hasImage, onClear }) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            onImageSelect(file);
        }
    }, [onImageSelect]);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) onImageSelect(file);
    }, [onImageSelect]);

    return (
        <div className="glass-card p-6">
            {/* Upload Title */}
            {!hasImage && (
                <div className="text-center mb-6">
                    <h2 className="font-pixel text-xs text-minecraft-accent mb-2">📸 사진 업로드</h2>
                    <p className="text-sm text-gray-400">
                        건물이나 구조물의 사진을 올려주세요. 스마트 분석으로 마인크래프트 블록 도면을 생성합니다.
                    </p>
                </div>
            )}

            {/* Upload Zone or Preview */}
            {!hasImage ? (
                <div
                    className={`upload-zone rounded-2xl p-12 text-center cursor-pointer
                      transition-all duration-300 ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleClick}
                >
                    <div className="text-6xl mb-4 animate-float">🏠</div>
                    <p className="text-gray-300 mb-2">
                        이미지를 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-gray-500">
                        JPG, PNG, WebP 지원 • 최대 20MB
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleChange}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="relative group">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-pixel text-xs text-minecraft-accent">📸 업로드된 이미지</h3>
                        <button
                            onClick={onClear}
                            className="text-sm text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                            <span>✕</span> 제거
                        </button>
                    </div>
                    <div className="flex justify-center">
                        <img
                            src={preview}
                            alt="Uploaded building"
                            className="rounded-xl max-h-[350px] object-contain border border-gray-700/50
                         shadow-lg shadow-black/30"
                        />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0
                          group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl cursor-pointer"
                        onClick={handleClick}
                    >
                        <span className="bg-black/60 text-white px-4 py-2 rounded-lg text-sm backdrop-blur">
                            🔄 다른 이미지 선택
                        </span>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleChange}
                        className="hidden"
                    />
                </div>
            )}
        </div>
    );
}

export default ImageUploader;
