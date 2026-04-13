import { useState, useCallback, useRef } from 'react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import BlockGrid from './components/BlockGrid';
import BlockPalette from './components/BlockPalette';
import ScaleControl from './components/ScaleControl';
import { loadImage } from './utils/imageProcessor';
import { smartAnalyze } from './utils/smartAnalyzer';

const VIEW_TABS = [
    { key: 'front', label: '정면도', icon: '🧱', desc: '앞에서 본 모습' },
    { key: 'side', label: '측면도', icon: '📐', desc: '옆에서 본 모습' },
    { key: 'top', label: '평면도', icon: '🗺️', desc: '위에서 본 모습' },
];

function App() {
    const [step, setStep] = useState('upload');
    const [image, setImage] = useState(null);
    const [gridSize, setGridSize] = useState(48);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [highlightBlock, setHighlightBlock] = useState(null);
    const [activeView, setActiveView] = useState('front');
    const resultRef = useRef(null);

    const handleImageSelect = useCallback(async (file) => {
        try {
            setError(null);
            const img = await loadImage(file);
            const preview = URL.createObjectURL(file);
            setImage({ file, preview, img });
            setStep('upload');
            setResult(null);
        } catch {
            setError('이미지를 불러올 수 없습니다.');
        }
    }, []);

    const handleConvert = useCallback(async () => {
        if (!image) return;
        setStep('processing');
        setProgress(0);
        setError(null);
        setHighlightBlock(null);
        setActiveView('front');

        try {
            await new Promise(r => requestAnimationFrame(r));

            const aspect = image.img.height / image.img.width;
            const gridHeight = Math.round(gridSize * aspect);

            const res = smartAnalyze(image.img, gridSize, gridHeight, (p) => setProgress(p));
            setResult(res);
            setStep('result');

            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        } catch (err) {
            console.error('Conversion error:', err);
            setError(`변환 실패: ${err.message}`);
            setStep('upload');
        }
    }, [image, gridSize]);

    const handleReset = useCallback(() => {
        if (image?.preview) URL.revokeObjectURL(image.preview);
        setImage(null);
        setResult(null);
        setStep('upload');
        setError(null);
        setProgress(0);
        setHighlightBlock(null);
        setActiveView('front');
    }, [image]);

    // Get current view data
    const currentView = result ? result[activeView] : null;

    return (
        <div className="min-h-screen pb-20">
            <Header />

            {error && (
                <div className="max-w-5xl mx-auto px-4 mt-4">
                    <div className="bg-red-900/40 border border-red-500/30 rounded-xl px-5 py-3 text-red-300 text-sm flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
                    </div>
                </div>
            )}

            <main className="max-w-6xl mx-auto px-4 mt-8">

                {/* Upload */}
                <section className="animate-fade-up">
                    <ImageUploader
                        onImageSelect={handleImageSelect}
                        preview={image?.preview}
                        hasImage={!!image}
                        onClear={handleReset}
                    />
                </section>

                {/* Controls */}
                {image && step !== 'processing' && (
                    <section className="mt-8 animate-fade-up">
                        <div className="glass-card p-6">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <ScaleControl
                                    value={gridSize}
                                    onChange={setGridSize}
                                    aspect={image.img.height / image.img.width}
                                />
                                <div className="ml-auto">
                                    <button
                                        onClick={handleConvert}
                                        className="px-8 py-3 bg-minecraft-accent text-minecraft-dark font-bold rounded-xl
                               hover:bg-minecraft-accent-dim transition-all duration-300
                               hover:shadow-[0_0_25px_rgba(74,222,128,0.4)]
                               active:scale-95 font-pixel text-xs"
                                    >
                                        ⛏️ 블록 변환
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Processing */}
                {step === 'processing' && (
                    <section className="mt-8 animate-fade-up">
                        <div className="glass-card p-8 text-center">
                            <div className="text-4xl mb-4 animate-float">⛏️</div>
                            <p className="font-pixel text-xs text-minecraft-accent mb-4">건물 분석 중...</p>
                            <div className="w-full max-w-md mx-auto h-3 bg-minecraft-darker rounded-full overflow-hidden">
                                <div className="h-full progress-bar rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-sm text-gray-500 mt-2">{progress}%</p>
                            <p className="text-xs text-gray-600 mt-3">
                                배경 제거 → 재질 분석 → 블록 매칭 → 3D 도면 생성
                            </p>
                        </div>
                    </section>
                )}

                {/* Results */}
                {step === 'result' && result && (
                    <section ref={resultRef} className="mt-8 space-y-6 animate-fade-up">

                        {/* Tips */}
                        {result.tips?.length > 0 && (
                            <div className="glass-card p-5">
                                <h3 className="font-pixel text-xs text-minecraft-gold mb-3">💡 건축 가이드</h3>
                                <ul className="space-y-2">
                                    {result.tips.map((tip, i) => (
                                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                            <span className="text-minecraft-accent mt-0.5">▸</span>
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Material Summary */}
                        {result.materialSummary && (
                            <div className="glass-card p-5">
                                <h3 className="font-pixel text-xs text-minecraft-diamond mb-3">🔍 감지된 재질</h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(result.materialSummary)
                                        .filter(([m]) => m !== 'fallback' && m !== 'air')
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([mat, count]) => {
                                            const total = result.front.width * result.front.height;
                                            const pct = (count / total * 100).toFixed(1);
                                            const labels = {
                                                brick: '🧱 벽돌', stone: '🪨 석재', concrete: '⬜ 콘크리트',
                                                wood: '🪵 나무', glass: '🪟 유리/창문',
                                                roof_dark: '🏠 지붕(암석)', roof_tile: '🏠 지붕(기와)',
                                                metal: '⚙️ 금속', door: '🚪 문', ground: '🟤 바닥',
                                                grass: '🌿 잔디', leaves: '🍃 나뭇잎',
                                                white: '⬜ 밝은면', dark: '⬛ 어두운면',
                                            };
                                            return (
                                                <span key={mat}
                                                    className="px-3 py-1.5 rounded-lg text-xs bg-minecraft-darker border border-minecraft-border text-gray-300">
                                                    {labels[mat] || mat} <span className="text-gray-500">{pct}%</span>
                                                </span>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                        )}

                        {/* View Tabs */}
                        <div className="flex gap-2 p-1 bg-minecraft-darker/50 rounded-xl w-fit mx-auto">
                            {VIEW_TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => { setActiveView(tab.key); setHighlightBlock(null); }}
                                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                    ${activeView === tab.key
                                            ? 'bg-minecraft-accent/15 text-minecraft-accent border border-minecraft-accent/20 shadow-lg shadow-minecraft-accent/10'
                                            : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <span>{tab.icon}</span>
                                    <span className="font-pixel text-[10px]">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Grid + Palette */}
                        {currentView && (
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                                <div className="glass-card p-5 overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-pixel text-xs text-minecraft-accent">
                                            {VIEW_TABS.find(t => t.key === activeView)?.icon}{' '}
                                            {VIEW_TABS.find(t => t.key === activeView)?.label}{' '}
                                            <span className="text-gray-500">({currentView.width}×{currentView.height})</span>
                                        </h3>
                                        <span className="text-xs text-gray-500">
                                            {VIEW_TABS.find(t => t.key === activeView)?.desc}
                                        </span>
                                    </div>

                                    <div className="flex flex-col xl:flex-row gap-4">
                                        {/* Original image (only for front view) */}
                                        {activeView === 'front' && image?.preview && (
                                            <div className="flex-shrink-0">
                                                <p className="text-xs text-gray-500 mb-2">원본</p>
                                                <img src={image.preview} alt="Original"
                                                    className="rounded-lg max-h-[300px] object-contain border border-gray-700/50" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-500 mb-2">블록 도면</p>
                                            <BlockGrid
                                                grid={currentView.grid}
                                                highlightBlock={highlightBlock}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <BlockPalette
                                    palette={currentView.palette}
                                    onHighlight={setHighlightBlock}
                                    highlightBlock={highlightBlock}
                                />
                            </div>
                        )}

                        {/* Reset */}
                        <div className="text-center">
                            <button onClick={handleReset}
                                className="px-6 py-2 text-sm text-gray-400 border border-gray-700 rounded-xl
                           hover:border-minecraft-accent/50 hover:text-minecraft-accent transition-all">
                                🔄 새 이미지로 시작
                            </button>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default App;
