import { useState } from 'react';

function ApiKeyModal({ onClose, onSave, currentMode, onSwitchToLocal }) {
    const [visionKey, setVisionKey] = useState('');
    const [llmKey, setLlmKey] = useState('');
    const [sameKey, setSameKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const vKey = visionKey.trim();
        const lKey = sameKey ? vKey : llmKey.trim();

        if (!vKey) {
            setError('나노바나나 2 API 키를 입력해주세요');
            return;
        }
        if (!sameKey && !lKey) {
            setError('GPT 5.4 API 키를 입력해주세요');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await onSave(vKey, lKey);
        } catch (err) {
            setError(err.message || '키 저장 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative glass-card-strong p-6 w-full max-w-md animate-fade-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-pixel text-xs text-minecraft-accent">🔑 API 설정</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">✕</button>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-5 p-1 bg-minecraft-darker rounded-xl">
                    <button
                        onClick={() => { }}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all bg-minecraft-accent/15 text-minecraft-accent border border-minecraft-accent/20"
                    >
                        🤖 AI 모드
                    </button>
                    <button
                        onClick={onSwitchToLocal}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all text-gray-500 hover:text-gray-300"
                    >
                        🎨 로컬 모드
                    </button>
                </div>

                {/* Info */}
                <div className="bg-minecraft-accent/5 border border-minecraft-accent/10 rounded-xl p-3 mb-5 text-xs text-gray-400">
                    <p><strong className="text-gray-300">나노바나나 2</strong> — 건물 사진을 분석하여 구조 파악 (Vision)</p>
                    <p className="mt-1"><strong className="text-gray-300">GPT 5.4</strong> — 분석 결과를 마인크래프트 블록 그리드로 변환 (LLM)</p>
                    <p className="mt-2 text-gray-500">키는 서버 세션에만 저장되며, 2시간 후 자동 삭제됩니다.</p>
                </div>

                {/* NanoBanana 2 Key */}
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1.5">
                        🍌 나노바나나 2 API Key <span className="text-gray-600">(Vision 분석용)</span>
                    </label>
                    <input
                        type="password"
                        value={visionKey}
                        onChange={(e) => setVisionKey(e.target.value)}
                        placeholder="nb-..."
                        className="w-full px-4 py-2.5 bg-minecraft-darker border border-minecraft-border rounded-xl
                       text-sm text-gray-200 placeholder-gray-600
                       focus:border-minecraft-accent/50 focus:outline-none focus:ring-1 focus:ring-minecraft-accent/20
                       transition-all"
                    />
                </div>

                {/* Same key toggle */}
                <label className="flex items-center gap-2 mb-4 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={sameKey}
                        onChange={(e) => setSameKey(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-minecraft-darker text-minecraft-accent
                       focus:ring-minecraft-accent/30 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                        두 모델 모두 같은 키 사용
                    </span>
                </label>

                {/* GPT 5.4 Key */}
                {!sameKey && (
                    <div className="mb-4 animate-fade-up">
                        <label className="block text-xs text-gray-400 mb-1.5">
                            🧠 GPT 5.4 API Key <span className="text-gray-600">(블록 그리드 생성용)</span>
                        </label>
                        <input
                            type="password"
                            value={llmKey}
                            onChange={(e) => setLlmKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-4 py-2.5 bg-minecraft-darker border border-minecraft-border rounded-xl
                         text-sm text-gray-200 placeholder-gray-600
                         focus:border-minecraft-accent/50 focus:outline-none focus:ring-1 focus:ring-minecraft-accent/20
                         transition-all"
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p className="text-xs text-red-400 mb-4">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 border border-minecraft-border
                       hover:border-gray-500 hover:text-gray-300 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-minecraft-accent text-minecraft-dark
                       hover:bg-minecraft-accent-dim transition-all disabled:opacity-50
                       hover:shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                    >
                        {saving ? '저장 중...' : '✓ 저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ApiKeyModal;
