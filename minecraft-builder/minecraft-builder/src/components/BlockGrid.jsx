import { useState, useRef, useMemo, useCallback } from 'react';

function BlockGrid({ grid, highlightBlock }) {
    const [hoveredCell, setHoveredCell] = useState(null);
    const [zoom, setZoom] = useState(1);
    const containerRef = useRef(null);

    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length || 0;

    // Calculate cell size based on container and grid dimensions
    const cellSize = useMemo(() => {
        const baseSize = Math.max(4, Math.min(16, Math.floor(600 / Math.max(gridWidth, gridHeight))));
        return Math.round(baseSize * zoom);
    }, [gridWidth, gridHeight, zoom]);

    const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.3, 3)), []);
    const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.3, 0.4)), []);
    const handleZoomReset = useCallback(() => setZoom(1), []);

    return (
        <div>
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 mb-3">
                <button onClick={handleZoomOut} className="w-7 h-7 flex items-center justify-center rounded-lg bg-minecraft-darker border border-minecraft-border text-gray-400 hover:text-minecraft-accent hover:border-minecraft-accent/40 transition-all text-sm">−</button>
                <button onClick={handleZoomReset} className="px-2 h-7 flex items-center justify-center rounded-lg bg-minecraft-darker border border-minecraft-border text-gray-400 hover:text-minecraft-accent text-xs transition-all">{Math.round(zoom * 100)}%</button>
                <button onClick={handleZoomIn} className="w-7 h-7 flex items-center justify-center rounded-lg bg-minecraft-darker border border-minecraft-border text-gray-400 hover:text-minecraft-accent hover:border-minecraft-accent/40 transition-all text-sm">+</button>
            </div>

            {/* Grid Container */}
            <div
                ref={containerRef}
                className="overflow-auto rounded-lg bg-minecraft-darker/50 p-2 max-h-[500px]"
                style={{ maxWidth: '100%' }}
            >
                <div
                    className="inline-grid gap-0 border border-gray-700/30"
                    style={{
                        gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
                        gridTemplateRows: `repeat(${gridHeight}, ${cellSize}px)`,
                    }}
                >
                    {grid.map((row, y) =>
                        row.map((block, x) => {
                            const isHighlighted = highlightBlock && block.id === highlightBlock;
                            const isDimmed = highlightBlock && block.id !== highlightBlock;
                            const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
                            const isAir = block.id === 'air';

                            return (
                                <div
                                    key={`${x}-${y}`}
                                    className="block-cell relative"
                                    style={{
                                        width: cellSize,
                                        height: cellSize,
                                        backgroundColor: isAir
                                            ? ((x + y) % 2 === 0 ? 'rgba(30,30,40,0.4)' : 'rgba(20,20,30,0.3)')
                                            : block.hex,
                                        opacity: isDimmed ? 0.2 : 1,
                                        outline: isHighlighted ? '1px solid rgba(74, 222, 128, 0.8)' : 'none',
                                    }}
                                    onMouseEnter={() => setHoveredCell({ x, y, block })}
                                    onMouseLeave={() => setHoveredCell(null)}
                                >
                                    {/* Tooltip */}
                                    {isHovered && cellSize >= 6 && (
                                        <div className="block-tooltip">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-sm border border-gray-600"
                                                    style={{ backgroundColor: block.hex }}
                                                />
                                                <div>
                                                    <span className="text-minecraft-accent font-medium">{block.nameKo}</span>
                                                    <span className="text-gray-500 ml-1">({block.name})</span>
                                                </div>
                                            </div>
                                            <div className="text-gray-500 text-[10px] mt-0.5">
                                                좌표: ({x}, {y})
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Grid Info */}
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{gridWidth} × {gridHeight} 블록</span>
                <span>총 {grid.flat().filter(b => b.id !== 'air').length} 블록 (공기 제외)</span>
            </div>
        </div>
    );
}

export default BlockGrid;
