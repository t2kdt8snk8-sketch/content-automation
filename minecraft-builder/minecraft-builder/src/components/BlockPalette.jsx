import { useState, useMemo } from 'react';
import { CATEGORIES } from '../data/minecraftBlocks';

function BlockPalette({ palette, onHighlight, highlightBlock }) {
    const [selectedCategory, setSelectedCategory] = useState('all');

    const filteredPalette = useMemo(() => {
        if (selectedCategory === 'all') return palette;
        return palette.filter(item => item.block.category === selectedCategory);
    }, [palette, selectedCategory]);

    const totalBlocks = useMemo(
        () => palette.reduce((sum, item) => sum + item.count, 0),
        [palette]
    );

    // Get unique categories from the palette
    const usedCategories = useMemo(() => {
        const cats = new Set(palette.map(item => item.block.category));
        return ['all', ...cats];
    }, [palette]);

    return (
        <div className="glass-card p-5 h-fit sticky top-4">
            <h3 className="font-pixel text-xs text-minecraft-gold mb-3">🎨 사용된 블록</h3>

            {/* Stats */}
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-400">
                <span>{palette.length}종류</span>
                <span className="text-gray-600">|</span>
                <span>총 {totalBlocks.toLocaleString()}개</span>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1 mb-4">
                {usedCategories.map(cat => {
                    const catInfo = CATEGORIES[cat];
                    const label = cat === 'all' ? '전체' : catInfo?.nameKo || cat;
                    const icon = cat === 'all' ? '📦' : catInfo?.icon || '🔲';

                    return (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-2 py-1 rounded-lg text-xs transition-all duration-200 ${selectedCategory === cat
                                    ? 'bg-minecraft-accent/20 text-minecraft-accent border border-minecraft-accent/30'
                                    : 'bg-minecraft-darker text-gray-500 border border-transparent hover:text-gray-300'
                                }`}
                        >
                            {icon} {label}
                        </button>
                    );
                })}
            </div>

            {/* Block List */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredPalette.map(({ block, count }) => {
                    const isActive = highlightBlock === block.id;
                    const percentage = ((count / totalBlocks) * 100).toFixed(1);

                    return (
                        <button
                            key={block.id}
                            onClick={() => onHighlight(isActive ? null : block.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200
                         text-left group ${isActive
                                    ? 'bg-minecraft-accent/15 border border-minecraft-accent/30'
                                    : 'hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {/* Color swatch */}
                            <div
                                className="w-6 h-6 rounded-md border border-gray-600 flex-shrink-0
                           group-hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: block.hex }}
                            />

                            {/* Block info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-200 truncate">
                                    {block.nameKo}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                    {block.name}
                                </div>
                            </div>

                            {/* Count */}
                            <div className="text-right flex-shrink-0">
                                <div className="text-xs text-gray-300 font-medium">
                                    {count}
                                </div>
                                <div className="text-[10px] text-gray-600">
                                    {percentage}%
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Clear highlight */}
            {highlightBlock && (
                <button
                    onClick={() => onHighlight(null)}
                    className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-minecraft-accent
                     border border-dashed border-gray-700 rounded-lg transition-colors"
                >
                    하이라이트 해제
                </button>
            )}
        </div>
    );
}

export default BlockPalette;
