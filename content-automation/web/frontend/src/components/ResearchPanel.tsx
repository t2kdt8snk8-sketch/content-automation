import { useEffect, useState } from 'react';

interface ResearchItem {
  id: string;
  title?: string;
  summary?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface ResearchDetail {
  [key: string]: unknown;
}

export function ResearchPanel() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [selected, setSelected] = useState<ResearchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void fetch('/api/research/archive', { credentials: 'include', signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { items: ResearchItem[] }) => {
        setItems(data.items ?? []);
        setLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || '데이터를 불러올 수 없습니다.');
        }
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const r = await fetch(`/api/research/archive/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as ResearchDetail;
      setSelected(data);
    } catch (err: unknown) {
      setDetailError((err as Error).message || '상세 정보를 불러올 수 없습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13 }}>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: 13 }}>{error}</div>;
  }

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            alignSelf: 'flex-start', background: 'transparent',
            border: '1px solid #2d3d69', color: 'rgba(255,255,255,0.6)',
            padding: '4px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
          }}
        >
          ← 목록으로
        </button>
        <div style={{ flex: 1, overflow: 'auto', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {detailLoading ? '로딩 중...' : detailError ? <span style={{ color: 'rgba(255,0,0,0.8)' }}>{detailError}</span> : JSON.stringify(selected, null, 2)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13 }}>리서치 데이터가 없습니다.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', height: '100%' }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => { void loadDetail(item.id); }}
          style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.75)', padding: '10px 12px',
            cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
            textAlign: 'left', flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {item.title ?? item.id}
          </div>
          {item.summary && (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {item.summary}
            </div>
          )}
          {item.created_at && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>
              {String(item.created_at)}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
