import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function AdminGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin/dashboard');
    } catch(err) {
      setError(true);
      setLoading(false);
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
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>E-mail de Acesso</label>
            <input 
              type="email" 
              placeholder="admin@interclasse.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ borderColor: error ? '#f87171' : '' }}
              required
            />
          </div>
          <div className="form-group">
            <label>Senha de Acesso</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ borderColor: error ? '#f87171' : '' }}
              required
            />
            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>E-mail ou senha incorretos.</p>}
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}
