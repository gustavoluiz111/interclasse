import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function AdminGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '121415gugu' || password === 'asaph') {
      localStorage.setItem('admin_asaph_auth', 'true');
      navigate('/admin/dashboard');
    } else {
      setError(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Lock size={48} color="var(--dourado)" />
        </div>
        
        <div style={{ background: 'linear-gradient(135deg, #3b0764, #1e1b4b)', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ background: 'var(--dourado)', display: 'inline-block', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', color: '#000', letterSpacing: 2 }}>SISTEMA ASAPH</div>
          <p style={{ fontSize: 13, color: '#a78bfa', marginTop: 8 }}>Acesso restrito à administração</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Senha de Acesso</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ borderColor: error ? '#f87171' : '' }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>Senha incorreta.</p>}
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Entrar no Painel</button>
        </form>
      </div>
    </div>
  );
}
