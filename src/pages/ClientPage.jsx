import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2, ChevronRight, Copy, Upload, ArrowLeft,
  Search, Plus, Trash2, Ticket, AlertCircle
} from 'lucide-react';
import { createOrder, uploadComprovante, fetchOrderByCodigo } from '../firebase/api';
import { gerarPixPayload } from '../utils/pix';
import Receipt from './Receipt';

const SHIRT_PRICE = 25;
// Chave aleatória PIX
const PIX_KEY = '76596b6d-8faa-4d4d-8d40-b7e261b11cf3';

const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG'];

// Each model has its own photo + color embedded (clicking photo = selects model+cor)
const MODELS = [
  { id: 'Roxa',   cor: 'Roxa',   label: 'ROXA',   desc: 'Camisa Roxa Napoli',   img: '/roxo.jpeg',   accent: '#7C3AED' },
  { id: 'Rosa',   cor: 'Rosa',   label: 'ROSA',   desc: 'Camisa Rosa Napoli',   img: '/rosa.jpeg',   accent: '#EC4899' },
  { id: 'Preta',  cor: 'Preta',  label: 'PRETA',  desc: 'Camisa Preta Napoli',  img: '/preta.jpeg',  accent: '#888' },
  { id: 'Branca', cor: 'Branca', label: 'BRANCA', desc: 'Camisa Branca Napoli', img: '/branco.jpeg', accent: '#D4AF37' },
];

const emptyShirt = () => ({ modelo: '', cor: '', tamanho: '', qtd: 1 });

const STATUS_MAP = {
  analise:  { label: '⏳ Em Análise', color: '#F59E0B' },
  aprovado: { label: '✅ Aprovado',   color: '#4ade80' },
  quitado:  { label: '✅ Quitado',    color: '#4ade80' },
  recusado: { label: '❌ Recusado',   color: '#f87171' },
};

export default function ClientPage() {
  const [step, setStep]     = useState('menu'); // menu | order | pix | success | search
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Customer
  const [nome, setNome]     = useState('');
  const [numero, setNumero] = useState('');
  const [pagamento, setPagamento] = useState('');

  // Shirts
  const [camisas, setCamisas] = useState([emptyShirt()]);

  // Upload
  const [comprovanteBase64, setComprovanteBase64] = useState('');

  // Success
  const [finishedOrder, setFinishedOrder]   = useState(null);
  const [showReceipt, setShowReceipt]       = useState(false);

  // Search
  const [searchCode, setSearchCode]     = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError]   = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Shirt helpers ──────────────────────────────────────────────────────────
  const updateShirt = (i, k, v) =>
    setCamisas(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addShirt    = () => setCamisas(p => [...p, emptyShirt()]);
  const removeShirt = (i) => setCamisas(p => p.filter((_, idx) => idx !== i));

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalQtd  = camisas.reduce((a, s) => a + (parseInt(s.qtd) || 1), 0);
  const total     = totalQtd * SHIRT_PRICE;
  const valorPago = pagamento === '2x' ? total / 2 : total;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goTo = (s) => { setError(''); setStep(s); };

  // ── Validate ──────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (!nome.trim())   return setError('Informe seu nome.');
    if (!numero.trim()) return setError('Informe seu número.');
    for (let i = 0; i < camisas.length; i++) {
      const s = camisas[i];
      if (!s.modelo)  return setError(`Camisa ${i + 1}: escolha o modelo.`);
      if (!s.cor)     return setError(`Camisa ${i + 1}: escolha a cor.`);
      if (!s.tamanho) return setError(`Camisa ${i + 1}: escolha o tamanho.`);
    }
    if (!pagamento) return setError('Escolha a forma de pagamento.');
    setError('');
    goTo('pix');
  };

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setComprovanteBase64(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!comprovanteBase64) return setError('Anexe o comprovante de pagamento.');
    setLoading(true);
    setError('');
    try {
      const orderData = {
        nome, numero, pagamento,
        camisas,
        total, valorPago,
        saldo: total - valorPago,
        modelo: camisas.map(s => s.modelo).join(' + '),
        cor:    camisas.map(s => s.cor).join(' + '),
        tamanho: camisas[0].tamanho,
        qtd: totalQtd,
      };
      const created = await createOrder(orderData);
      await uploadComprovante(created.codigo, comprovanteBase64);
      setFinishedOrder(created);
      setShowReceipt(true);
      goTo('success');
    } catch (e) {
      console.error(e);
      setError(`Erro ao enviar pedido: ${e.message}. Verifique sua conexão e tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) return setSearchError('Digite o código do pedido.');
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError('');
    try {
      const order = await fetchOrderByCodigo(code);
      if (order) setSearchResult(order);
      else        setSearchError('Pedido não encontrado. Verifique o código.');
    } catch (e) {
      setSearchError(`Erro: ${e.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const pixPayload = gerarPixPayload(PIX_KEY, valorPago.toString(), nome || 'PAGADOR');

  // ── Error Banner ───────────────────────────────────────────────────────────
  const ErrorBanner = ({ msg }) => msg ? (
    <div style={{
      background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10, color: '#fca5a5', fontSize: 14,
    }}>
      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{msg}</span>
    </div>
  ) : null;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
    {/* Receipt modal */}
    {showReceipt && finishedOrder && (
      <Receipt order={finishedOrder} onClose={() => setShowReceipt(false)} />
    )}
    {searchResult && showReceipt && (
      <Receipt order={searchResult} onClose={() => setShowReceipt(false)} />
    )}

    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 90px' }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 36 }} className="animate-fade-in">
        <div style={{
          background: 'linear-gradient(135deg, var(--dourado), var(--dourado-light))',
          display: 'inline-block', padding: '4px 14px', borderRadius: 5,
          fontSize: 11, fontWeight: 800, color: '#000', marginBottom: 10,
          letterSpacing: 3, textTransform: 'uppercase',
        }}>
          3º Ano EM · 2025
        </div>
        <h1 style={{ fontFamily: 'var(--fonte-display)', fontSize: 'clamp(40px, 10vw, 68px)', lineHeight: 0.9, letterSpacing: 2 }}>
          CAMISAS<br />
          <span className="gradient-text">INTERCLASSE</span>
        </h1>
        <p style={{ color: 'var(--texto2)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 3, marginTop: 10 }}>
          Faça seu pedido · Pague · Acompanhe
        </p>
      </div>

      {/* ─── MENU ────────────────────────────────────────────────────────────── */}
      {step === 'menu' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-primary"
            style={{ padding: '20px 24px', fontSize: 20, letterSpacing: 3 }}
            onClick={() => goTo('order')}
          >
            👕 Fazer Pedido <ChevronRight size={22} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '18px 24px', fontSize: 16 }}
            onClick={() => { goTo('search'); setSearchResult(null); setSearchError(''); setSearchCode(''); }}
          >
            <Search size={20} /> Buscar Meu Pedido
          </button>
        </div>
      )}

      {/* ─── ORDER FORM ──────────────────────────────────────────────────────── */}
      {step === 'order' && (
        <div className="animate-fade-in">
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 18, gap: 6, display: 'inline-flex' }} onClick={() => goTo('menu')}>
            <ArrowLeft size={14} /> Voltar
          </button>

          <ErrorBanner msg={error} />

          {/* Customer */}
          <div className="card">
            <h2 className="card-title"><div className="dot" /> Seus Dados</h2>
            <div className="form-group">
              <label>Nome (como ficará na camisa)</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Lucas" />
            </div>
            <div className="form-group">
              <label>Número</label>
              <input type="number" min="1" max="99" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 10" />
            </div>
          </div>

          {/* Shirts */}
          {camisas.map((s, idx) => (
            <div key={idx} className="card">
              <h2 className="card-title">
                <div className="dot" />
                Camisa {idx + 1}
                {camisas.length > 1 && (
                  <button onClick={() => removeShirt(idx)} style={{
                    marginLeft: 'auto', background: 'rgba(248,113,113,0.12)',
                    border: '1px solid rgba(248,113,113,0.3)',
                    color: '#f87171', borderRadius: 6, padding: '4px 8px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </h2>

              {/* Shirt photo selector — clicking photo selects model+color */}
              <div style={{ marginBottom: 14 }}>
                <label>Escolha a Camisa (toque para selecionar)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {MODELS.map(m => {
                    const selected = s.modelo === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          updateShirt(idx, 'modelo', m.id);
                          updateShirt(idx, 'cor', m.cor);
                        }}
                        style={{
                          borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                          border: `3px solid ${selected ? m.accent : 'var(--cinza3)'}`,
                          boxShadow: selected ? `0 0 20px ${m.accent}55, 0 4px 12px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.4)',
                          transition: 'all 0.2s',
                          position: 'relative',
                          transform: selected ? 'scale(1.02)' : 'scale(1)',
                        }}
                      >
                        <img
                          src={m.img}
                          alt={m.label}
                          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{
                          padding: '8px 10px',
                          background: selected ? m.accent : 'var(--cinza2)',
                          transition: 'background 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div>
                            <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 14, letterSpacing: 1, color: selected ? '#fff' : 'var(--texto)', fontWeight: 700 }}>{m.label}</div>
                            <div style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.8)' : 'var(--texto2)' }}>{m.desc}</div>
                          </div>
                          {selected && <div style={{ fontSize: 18 }}>✓</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Size + Qty */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Tamanho</label>
                  <select value={s.tamanho} onChange={e => updateShirt(idx, 'tamanho', e.target.value)}>
                    <option value="">Escolher</option>
                    {SIZES.map(sz => <option key={sz}>{sz}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" min="1" max="10" value={s.qtd} onChange={e => updateShirt(idx, 'qtd', parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-secondary" style={{ marginBottom: 16, gap: 8 }} onClick={addShirt}>
            <Plus size={17} /> Adicionar outra camisa
          </button>

          {/* Payment */}
          <div className="card">
            <h2 className="card-title"><div className="dot" /> Pagamento</h2>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 13, color: 'var(--texto2)' }}>
                {totalQtd} camisa{totalQtd !== 1 ? 's' : ''} × R$ {SHIRT_PRICE} =
              </span>
              <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 48, color: 'var(--dourado-light)', lineHeight: 1, marginTop: 4 }}>
                R$ {total.toFixed(2).replace('.', ',')}
              </div>
            </div>
            <div className="grid-2">
              {[
                { id: '1x', label: 'À Vista', sub: `R$ ${total.toFixed(2)}` },
                { id: '2x', label: 'Parcelado', sub: `2× R$ ${(total/2).toFixed(2)}` },
              ].map(op => (
                <div key={op.id} onClick={() => setPagamento(op.id)} style={{
                  background: pagamento === op.id ? 'rgba(124,58,237,0.12)' : 'var(--cinza2)',
                  border: `2px solid ${pagamento === op.id ? 'var(--roxo-light)' : 'var(--cinza3)'}`,
                  borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer',
                  boxShadow: pagamento === op.id ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 26, color: 'var(--dourado-light)' }}>{op.sub}</div>
                  <div style={{ fontSize: 13, color: 'var(--texto2)', marginTop: 3 }}>{op.label}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: 4 }}>
            Continuar para o PIX <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* ─── PIX ─────────────────────────────────────────────────────────────── */}
      {step === 'pix' && (
        <div className="animate-fade-in">
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 18, gap: 6, display: 'inline-flex' }} onClick={() => goTo('order')}>
            <ArrowLeft size={14} /> Voltar
          </button>

          <ErrorBanner msg={error} />

          {/* ─── RESUMO / CONFIRMAÇÃO ─── */}
          <div className="card" style={{ padding: '24px 20px', background: 'rgba(147, 51, 234, 0.05)', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
            <h2 className="card-title" style={{ marginBottom: 12 }}><div className="dot" /> Confirme seu Pedido</h2>
            <div style={{ fontSize: 13, color: 'var(--texto)', marginBottom: 16 }}>
              Verifique se os dados abaixo estão corretos antes de fazer o pagamento:
            </div>
            
            <div style={{ background: 'var(--cinza)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--cinza3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--cinza4)', paddingBottom: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 1 }}>Jogador</span>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{nome} <span style={{ color: 'var(--roxo-light)' }}>#{numero}</span></span>
              </div>
              
              {camisas.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{c.qtd}x</span> {c.modelo} ({c.cor})
                  </div>
                  <div style={{ color: 'var(--texto2)', fontSize: 12 }}>Tam: {c.tamanho}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Pedido</span>
              <span style={{ fontFamily: 'var(--fonte-display)', fontSize: 24, color: 'var(--dourado-light)' }}>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <h2 className="card-title" style={{ justifyContent: 'center' }}>Pagar via PIX</h2>
            <p style={{ color: 'var(--texto2)', fontSize: 14, marginBottom: 18 }}>
              Valor: <strong style={{ color: 'var(--dourado-light)', fontSize: 18 }}>R$ {valorPago.toFixed(2).replace('.', ',')}</strong><br />
              <span style={{ fontSize: 12 }}>({pagamento === '2x' ? '1ª Parcela' : 'Pagamento Único'})</span>
            </p>
            {/* QR Code real do usuário */}
            <div style={{
              background: '#fff', padding: 14, borderRadius: 16, display: 'inline-block',
              marginBottom: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <img src="/pix.jpg" alt="QR Code PIX" style={{ width: 200, height: 200, objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{
              background: 'var(--cinza2)', border: '1px solid var(--cinza3)',
              padding: '10px 14px', borderRadius: 9, fontFamily: 'monospace',
              color: 'var(--dourado-light)', marginBottom: 14, fontSize: 13,
              wordBreak: 'break-all', letterSpacing: 1,
            }}>
              {PIX_KEY}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: 'auto', margin: '0 auto' }}
              onClick={() => { navigator.clipboard.writeText(PIX_KEY); alert('Chave Pix copiada!'); }}>
              <Copy size={16} /> Copiar Chave Aleatória
            </button>
          </div>

          <div className="card">
            <h2 className="card-title"><div className="dot" /> Anexar Comprovante</h2>
            <label style={{
              display: 'block',
              border: `2px dashed ${comprovanteBase64 ? 'var(--roxo-light)' : 'var(--cinza3)'}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
              background: comprovanteBase64 ? 'rgba(124,58,237,0.06)' : 'transparent',
              transition: 'all 0.25s',
            }}>
              <input type="file" style={{ display: 'none' }} accept="image/*,application/pdf" onChange={handleFileChange} />
              {comprovanteBase64 ? (
                <>
                  <CheckCircle2 color="var(--roxo-light)" size={40} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: 'var(--texto)', fontWeight: 600 }}>Comprovante anexado!</div>
                  <img src={comprovanteBase64} alt="Preview" style={{ width: 90, borderRadius: 8, marginTop: 12, border: '2px solid var(--cinza3)' }} />
                </>
              ) : (
                <>
                  <Upload color="var(--texto2)" size={36} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: 'var(--texto2)', fontSize: 14 }}>Toque para anexar o comprovante</div>
                  <div style={{ color: 'var(--texto2)', fontSize: 12, marginTop: 4 }}>PNG, JPG ou PDF</div>
                </>
              )}
            </label>
          </div>

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enviando pedido...' : 'Enviar Pedido ✓'}
          </button>
        </div>
      )}

      {/* ─── SUCCESS ─────────────────────────────────────────────────────────── */}
      {step === 'success' && finishedOrder && (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '50px 24px' }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
          <h1 style={{ fontFamily: 'var(--fonte-display)', fontSize: 52, color: 'var(--branco)' }}>PEDIDO ENVIADO!</h1>
          <p style={{ color: 'var(--texto2)', marginBottom: 24, fontSize: 15 }}>
            Seu pedido está em análise. Guarde o código abaixo!
          </p>

          <div style={{
            background: 'var(--cinza2)', border: '2px solid var(--dourado)',
            borderRadius: 14, padding: '20px 24px', marginBottom: 24,
            boxShadow: '0 0 24px rgba(245,158,11,0.15)',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--texto2)', marginBottom: 8 }}>
              Código do Pedido
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 32, color: 'var(--dourado-light)', letterSpacing: 5, fontWeight: 'bold' }}>
              {finishedOrder.codigo}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-gold" onClick={() => setShowReceipt(true)}>
              <Ticket size={20} /> Ver Comprovante
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setSearchCode(finishedOrder.codigo);
              setSearchResult(finishedOrder);
              goTo('search');
            }}>
              <Search size={18} /> Acompanhar Pedido
            </button>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--texto2)', cursor: 'pointer', fontSize: 13, marginTop: 4 }}
              onClick={() => window.location.reload()}
            >
              Fazer novo pedido
            </button>
          </div>
        </div>
      )}

      {/* ─── SEARCH ──────────────────────────────────────────────────────────── */}
      {step === 'search' && (
        <div className="animate-fade-in">
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 18, gap: 6, display: 'inline-flex' }} onClick={() => goTo('menu')}>
            <ArrowLeft size={14} /> Voltar
          </button>

          <div className="card">
            <h2 className="card-title"><div className="dot" /> Buscar Pedido</h2>
            <div style={{ display: 'flex', gap: 9 }}>
              <input
                type="text"
                placeholder="Ex: IC-2025-AB12"
                value={searchCode}
                onChange={e => setSearchCode(e.target.value.toUpperCase())}
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSearch}
                disabled={searchLoading}
                style={{ flexShrink: 0, padding: '12px 18px' }}
              >
                {searchLoading ? '...' : <Search size={18} />}
              </button>
            </div>
          </div>

          {searchError && (
            <div style={{
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 12, padding: 20, textAlign: 'center', color: '#fca5a5',
            }}>
              {searchError}
            </div>
          )}

          {searchResult && !showReceipt && (
            <div className="card animate-fade-in">
              {/* Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 22, letterSpacing: 1 }}>{searchResult.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--texto2)' }}>#{searchResult.numero} · {searchResult.codigo}</div>
                  <div style={{ fontSize: 12, color: 'var(--texto2)' }}>Pedido em {searchResult.data}</div>
                </div>
                <div style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: 'var(--cinza2)',
                  color: STATUS_MAP[searchResult.status]?.color || 'var(--texto)',
                  border: `1px solid ${STATUS_MAP[searchResult.status]?.color || 'var(--cinza3)'}`,
                  flexShrink: 0,
                }}>
                  {STATUS_MAP[searchResult.status]?.label || searchResult.status}
                </div>
              </div>

              {/* items */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Itens</div>
                {searchResult.camisas ? searchResult.camisas.map((s, i) => (
                  <div key={i} style={{ background: 'var(--cinza2)', borderRadius: 9, padding: '9px 14px', marginBottom: 7, fontSize: 14, borderLeft: '3px solid var(--roxo-light)' }}>
                    <strong style={{ color: 'var(--roxo-light)' }}>C{i+1}:</strong> {s.modelo} · {s.cor} · Tam {s.tamanho} · {s.qtd}x
                  </div>
                )) : (
                  <div style={{ background: 'var(--cinza2)', borderRadius: 9, padding: '9px 14px', fontSize: 14, borderLeft: '3px solid var(--roxo-light)' }}>
                    {searchResult.modelo} · {searchResult.cor} · Tam {searchResult.tamanho} · {searchResult.qtd}x
                  </div>
                )}
              </div>

              {/* Financials */}
              <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Total', value: `R$ ${(searchResult.total||0).toFixed(2)}`, color: 'var(--dourado-light)' },
                  { label: 'Saldo Aberto', value: `R$ ${(searchResult.saldo||0).toFixed(2)}`, color: searchResult.saldo > 0 ? '#f87171' : '#4ade80' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--cinza2)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 24, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <button className="btn btn-gold btn-sm" style={{ width: '100%', marginBottom: 10 }} onClick={() => setShowReceipt(true)}>
                <Ticket size={16} /> Ver Comprovante Detalhado
              </button>

              {/* Histórico */}
              {searchResult.historico?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Histórico</div>
                  {[...searchResult.historico].reverse().map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dourado-light)', marginTop: 4, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13 }}>{h.acao}</div>
                        <div style={{ fontSize: 11, color: 'var(--texto2)' }}>{h.data}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
