import { useState } from 'react';

interface LoginScreenProps {
  onLogin: (token: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (res.ok && data.token) {
        sessionStorage.setItem('auth_token', data.token);
        onLogin(data.token);
      } else {
        setError(data.error ?? '로그인 실패');
      }
    } catch {
      setError('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #182341 0%, #0b1020 60%)',
      }}
    >
      <div
        style={{
          width: 320,
          background: 'rgba(18,26,49,0.95)',
          border: '2px solid #2d3d69',
          padding: 32,
          boxShadow: '4px 4px 0 #0a0a14',
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8, fontFamily: 'monospace' }}>
          Marketing Workspace
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontSize: 14 }}>
          비밀번호를 입력하세요
        </p>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#0d1428',
              border: '1px solid #2d3d69',
              color: 'rgba(255,255,255,0.9)',
              marginBottom: 12,
              fontSize: 16,
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: loading ? '#3a4a6a' : '#5b8cff',
              color: 'white',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            {loading ? '로그인 중...' : '입장'}
          </button>
        </form>
      </div>
    </div>
  );
}
