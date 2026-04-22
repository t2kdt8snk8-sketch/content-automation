function ScaleControl({ value, onChange, aspect }) {
    const height = Math.round(value * aspect);

    const presets = [
        { label: 'S', value: 24, desc: '24블록' },
        { label: 'M', value: 48, desc: '48블록' },
        { label: 'L', value: 64, desc: '64블록' },
        { label: 'XL', value: 96, desc: '96블록' },
    ];

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <label className="font-pixel text-xs text-minecraft-accent">
                            📐 그리드 크기
                        </label>
                        <span className="text-sm text-gray-400">
                            {value} × {height} 블록
                        </span>
                    </div>

                    {/* Slider */}
                    <input
                        type="range"
                        min={16}
                        max={128}
                        step={4}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer
                       bg-minecraft-darker
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-minecraft-accent
                       [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(74,222,128,0.4)]
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:transition-all
                       [&::-webkit-slider-thumb]:hover:scale-125"
                    />

                    {/* Labels */}
                    <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                        <span>16</span>
                        <span>48</span>
                        <span>80</span>
                        <span>128</span>
                    </div>
                </div>

                {/* Presets */}
                <div className="flex gap-1.5">
                    {presets.map(preset => (
                        <button
                            key={preset.value}
                            onClick={() => onChange(preset.value)}
                            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all duration-200
                         flex items-center justify-center ${value === preset.value
                                    ? 'bg-minecraft-accent text-minecraft-dark shadow-[0_0_12px_rgba(74,222,128,0.3)]'
                                    : 'bg-minecraft-darker text-gray-500 hover:text-minecraft-accent border border-minecraft-border hover:border-minecraft-accent/30'
                                }`}
                            title={preset.desc}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scale hint */}
            <p className="text-[10px] text-gray-600 mt-2">
                💡 값이 클수록 디테일이 높지만, 처리 시간이 길어집니다
            </p>
        </div>
    );
}

export default ScaleControl;
