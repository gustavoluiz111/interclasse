import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, Copy, Upload, ArrowLeft,
  Search, Plus, Trash2, Ticket, AlertCircle, Lock
} from 'lucide-react';
import { createOrder, uploadComprovante, fetchOrderByCodigo, uploadComprovante2, fetchSettings } from '../firebase/api';
import { gerarPixPayload } from '../utils/pix';
import Receipt from './Receipt';
import Aurora from '../components/Aurora';
import RotatingText from '../components/RotatingText';
import HowItWorksPopup from '../components/HowItWorksPopup';

const SHIRT_PRICE = 25;
// Chave aleatória PIX
const PIX_KEY = 'c73111a7-eeec-49a3-b4a1-c7c73bba0b64';


// Each model has its own photo + color embedded (clicking photo = selects model+cor)
const BASE_URL = import.meta.env.BASE_URL;
const MODELS = [
  { id: 'Roxa',   cor: 'Roxa',   label: 'ROXA',   desc: 'Camisa Roxa Napoli',   img: `${BASE_URL}roxo.jpeg`,   accent: '#7C3AED' },
  { id: 'Rosa',   cor: 'Rosa',   label: 'ROSA',   desc: 'Camisa Rosa Napoli',   img: `${BASE_URL}rosa.jpeg`,   accent: '#EC4899' },
];

const emptyShirt = () => ({ modelo: '', cor: '', tamanho: '', qtd: 1, nome: '', numero: '' });

const STATUS_MAP = {
  analise:  { label: '⏳ Em Análise', color: '#F59E0B' },
  aprovado: { label: '✅ Aprovado',   color: '#4ade80' },
  quitado:  { label: '✅ Quitado',    color: '#4ade80' },
  recusado: { label: '❌ Recusado',   color: '#f87171' },
};

export default function ClientPage() {
  const routerNavigate = useNavigate();
  const [step, setStep]     = useState('menu'); // menu | order | pix | success | search
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [ordersLocked, setOrdersLocked] = useState(false);

  // Customer (Buyer Details)
  const [compradorNome, setCompradorNome] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [compradorTelefone, setCompradorTelefone] = useState('');

  const [pagamento, setPagamento] = useState('1x');

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

  // How it works popup
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Size chart popup
  const [showSizeChart, setShowSizeChart] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const settings = await fetchSettings();
        setOrdersLocked(!!settings.ordersLocked);
      } catch (err) {
        console.error("Erro ao obter configurações:", err);
      }
    };
    checkSettings();
  }, []);

  // ── Shirt helpers ──────────────────────────────────────────────────────────
  const updateShirt = (i, k, v) =>
    setCamisas(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addShirt    = () => setCamisas(p => [...p, emptyShirt()]);
  const removeShirt = (i) => setCamisas(p => p.filter((_, idx) => idx !== i));
  const duplicateShirt = (i) => setCamisas(p => [...p, { ...p[i] }]);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalQtd  = camisas.reduce((a, s) => a + (parseInt(s.qtd) || 1), 0);
  const total     = totalQtd * SHIRT_PRICE;
  const valorPago = pagamento === '2x' ? total / 2 : total;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goTo = (s) => {
    if (s === 'order' && ordersLocked) {
      setError('Novos pedidos suspensos temporariamente.');
      return;
    }
    setError('');
    setStep(s);
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (!compradorNome.trim() || !compradorEmail.trim() || !compradorTelefone.trim()) {
      return setError('Preencha os dados do comprador para receber os recibos.');
    }
    for (let i = 0; i < camisas.length; i++) {
      const s = camisas[i];
      if (!String(s.nome).trim()) return setError(`Camisa ${i + 1}: Informe o nome na estampa.`);
      if (!String(s.numero).trim()) return setError(`Camisa ${i + 1}: Informe o número na estampa.`);
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
      const currentSettings = await fetchSettings();
      if (currentSettings.ordersLocked) {
        throw new Error('Novos pedidos foram suspensos temporariamente pela administração.');
      }
      // Garante que numero sempre seja string
      const camisasNormalizadas = camisas.map(s => ({
        ...s,
        nome: String(s.nome).trim(),
        numero: String(s.numero).trim(),
        qtd: parseInt(s.qtd) || 1,
      }));
      const orderData = {
        compradorNome, compradorEmail, compradorTelefone,
        pagamento,
        camisas: camisasNormalizadas,
        total, valorPago,
        saldo: total - valorPago,
        modelo: camisasNormalizadas.map(s => s.modelo).join(' + '),
        cor:    camisasNormalizadas.map(s => s.cor).join(' + '),
        tamanho: camisasNormalizadas[0].tamanho,
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

  const pixPayload = gerarPixPayload(PIX_KEY, valorPago.toString(), compradorNome || 'PAGADOR');

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
    {/* Aurora Background */}
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    }}>
      <Aurora
        colorStops={['#3b0764', '#7C3AED', '#1e1b4b']}
        amplitude={1.2}
        blend={0.6}
        speed={0.8}
      />
    </div>

    {/* Floating Help Button */}
    {step === 'menu' && (
      <button 
        onClick={() => setShowHowItWorks(true)}
        className="animate-float"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 50,
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <div style={{
          width: 66, height: 66, borderRadius: '50%', background: 'linear-gradient(135deg, var(--roxo-light), #3b0764)',
          border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s'
        }}>
          <img src={`${import.meta.env.BASE_URL}napolao.png`} alt="Napolão" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{
          background: '#fff', color: '#000', padding: '4px 10px', borderRadius: 12,
          fontSize: 11, fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontFamily: 'var(--fonte-cond)', letterSpacing: 1
        }}>
          Como funciona?
        </div>
      </button>
    )}

    {/* How it Works modal */}
    {showHowItWorks && (
      <HowItWorksPopup onClose={() => setShowHowItWorks(false)} />
    )}

    {/* Size Chart Modal */}
    {showSizeChart && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }} onClick={() => setShowSizeChart(false)}>
        <div className="card animate-fade-in" style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Tabela de Medidas</h2>
            <button onClick={() => setShowSizeChart(false)} style={{ background: 'none', border: 'none', color: 'var(--texto)', fontSize: 24, cursor: 'pointer' }}>&times;</button>
          </div>
          
          <h3 style={{ color: 'var(--dourado-light)', marginBottom: 8, fontSize: 16 }}>Adulto</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, textAlign: 'center', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Tamanho</th>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Altura</th>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Largura</th>
              </tr>
            </thead>
            <tbody>
              {[['PP', '59 cm', '44 cm'], ['P', '62 cm', '45 cm'], ['M', '66 cm', '52 cm'], ['G', '69 cm', '56 cm'], ['GG', '74 cm', '58 cm'], ['XG', '82 cm', '65 cm']].map(row => (
                <tr key={row[0]}>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)', fontWeight: 'bold' }}>{row[0]}</td>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)' }}>{row[1]}</td>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)' }}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ color: 'var(--dourado-light)', marginBottom: 8, fontSize: 16 }}>Infantil</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Tamanho</th>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Altura</th>
                <th style={{ padding: 8, border: '1px solid var(--cinza3)' }}>Largura</th>
              </tr>
            </thead>
            <tbody>
              {[['4A', '50 cm', '37 cm'], ['6A', '53 cm', '40 cm'], ['8A', '58 cm', '43 cm'], ['10A', '60 cm', '45 cm'], ['12A', '65 cm', '47 cm']].map(row => (
                <tr key={row[0]}>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)', fontWeight: 'bold' }}>{row[0]}</td>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)' }}>{row[1]}</td>
                  <td style={{ padding: 8, border: '1px solid var(--cinza3)' }}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--texto2)', marginTop: 16, textAlign: 'center' }}>
            * As medidas podem sofrer variações de até 2cm.
          </p>
        </div>
      </div>
    )}

    {/* Receipt modal — mostra searchResult se disponível, senão finishedOrder */}
    {showReceipt && (searchResult || finishedOrder) && (
      <Receipt
        order={searchResult || finishedOrder}
        onClose={() => setShowReceipt(false)}
      />
    )}

    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 90px', position: 'relative', zIndex: 1 }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 36 }} className="animate-fade-in">
        {/* ─── AVISO PRAZO ─── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.18), rgba(236,72,153,0.10))', border: '1px solid var(--dourado)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>📅</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 14, letterSpacing: 1, color: 'var(--dourado-light)', textTransform: 'uppercase', marginBottom: 4 }}>Prazo de pedidos encerra em breve!</div>
            <div style={{ fontSize: 13, color: 'var(--texto2)', lineHeight: 1.5 }}>Recebimento de pedidos até <strong style={{ color: 'var(--dourado-light)' }}>17 ou 18 de junho</strong> · Entrega prevista em <strong style={{ color: 'var(--dourado-light)' }}>30 dias</strong> após o fechamento</div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, var(--dourado), var(--dourado-light))',
          display: 'inline-block', padding: '4px 14px', borderRadius: 5,
          fontSize: 11, fontWeight: 800, color: '#000', marginBottom: 10,
          letterSpacing: 3, textTransform: 'uppercase',
        }}>
          Napoli 2026
        </div>
        <h1 style={{ fontFamily: 'var(--fonte-display)', fontSize: 'clamp(40px, 10vw, 68px)', lineHeight: 0.9, letterSpacing: 2 }}>
          CAMISAS<br />
          <span style={{ display: 'inline-block', overflow: 'hidden', minWidth: 260 }}>
            <RotatingText
              texts={['NAPOLI', 'MAIOR', 'DA', 'EAPC']}
              rotationInterval={2200}
              staggerDuration={0.04}
              staggerFrom="first"
              splitBy="characters"
              mainClassName="gradient-text"
              elementLevelClassName="gradient-text"
              transition={{ type: 'spring', damping: 22, stiffness: 180 }}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-110%', opacity: 0 }}
              style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}
            />
          </span>
        </h1>
        <p style={{ color: 'var(--texto2)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 3, marginTop: 10 }}>
          Faça seu pedido · Pague · Acompanhe
        </p>
      </div>

      {/* ─── MENU ────────────────────────────────────────────────────────────── */}
      {step === 'menu' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ordersLocked ? (
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(124, 58, 237, 0.05))',
              border: '2px dashed rgba(239, 68, 68, 0.4)',
              borderRadius: 14,
              padding: '24px 20px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)',
              marginBottom: 4
            }}>
              <Lock size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 18, color: '#fff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Novos Pedidos Fechados
              </div>
              <p style={{ fontSize: 13, color: 'var(--texto2)', lineHeight: 1.5, margin: 0 }}>
                O recebimento de novos pedidos está suspenso temporariamente. Se você já tem um pedido, pode consultá-lo clicando no botão de busca abaixo.
              </p>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '20px 24px', fontSize: 20, letterSpacing: 3 }}
              onClick={() => goTo('order')}
            >
              👕 Fazer Pedido <ChevronRight size={22} />
            </button>
          )}
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

          {/* Contact Data */}
          <div className="card">
            <h2 className="card-title"><div className="dot" /> 1. Dados do Comprador (Contato)</h2>
            <div className="form-group">
              <label>Nome Completo do Responsável</label>
              <input type="text" value={compradorNome} onChange={e => setCompradorNome(e.target.value)} placeholder="Ex: Maria da Silva" />
            </div>
            <div className="form-group grid-2">
              <div>
                <label>E-mail (Recibos)</label>
                <input type="email" value={compradorEmail} onChange={e => setCompradorEmail(e.target.value)} placeholder="exemplo@gmail.com" />
              </div>
              <div>
                <label>WhatsApp</label>
                <input type="tel" value={compradorTelefone} onChange={e => setCompradorTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </div>

          {/* Shirts */}
          {camisas.map((s, idx) => (
            <div key={idx} className="card">
              <h2 className="card-title">
                <div className="dot" />
                Camisa {idx + 1}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => duplicateShirt(idx)} style={{
                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                    color: '#3b82f6', borderRadius: 6, padding: '4px 8px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                  }}>
                    <Copy size={14} /> Duplicar
                  </button>
                  {camisas.length > 1 && (
                    <button onClick={() => removeShirt(idx)} style={{
                      background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
                      color: '#f87171', borderRadius: 6, padding: '4px 8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </h2>

              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nome na Camisa (Costas)</label>
                  <input type="text" value={s.nome} onChange={e => updateShirt(idx, 'nome', e.target.value)} placeholder="Ex: L GUSTAVO" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Número na Camisa</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={s.numero}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      updateShirt(idx, 'numero', val);
                    }}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

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

              {/* Size */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ margin: 0 }}>Tamanho</label>
                  <button type="button" onClick={() => setShowSizeChart(true)} style={{ color: 'var(--roxo-light)', textDecoration: 'underline', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    Ver Tabela de Medidas
                  </button>
                </div>
                <select value={s.tamanho} onChange={e => updateShirt(idx, 'tamanho', e.target.value)}>
                  <option value="">Escolher</option>
                  <optgroup label="Adulto">
                    {['PP', 'P', 'M', 'G', 'GG', 'XG'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </optgroup>
                  <optgroup label="Infantil">
                    {['4A', '6A', '8A', '10A', '12A'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </optgroup>
                </select>
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
            
            <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid var(--dourado)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: 'var(--dourado-light)', textAlign: 'center' }}>
              ⚠️ No momento estamos aceitando apenas <strong>pagamento à vista (parcela única)</strong>.
            </div>

            <div className="grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {[
                { id: '1x', label: 'Pagamento único (à vista)', sub: `R$ ${total.toFixed(2).replace('.', ',')}` },
              ].map(op => (
                <div key={op.id} onClick={() => setPagamento(op.id)} style={{
                  background: 'rgba(124,58,237,0.12)',
                  border: '2px solid var(--roxo-light)',
                  borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(124,58,237,0.2)',
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
                <span style={{ fontSize: 11, color: 'var(--texto2)', textTransform: 'uppercase', letterSpacing: 1 }}>Comprador</span>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{compradorNome}</span>
              </div>
              
              {camisas.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: i < camisas.length -1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div>
                    <div style={{ marginBottom: 4 }}><span style={{ color: '#fff', fontWeight: 600 }}>{c.qtd}x</span> {c.modelo} ({c.cor})</div>
                    <div style={{ color: 'var(--texto2)', fontSize: 11 }}>Nome: <span style={{color: '#fff'}}>{c.nome}</span> #{c.numero}</div>
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
              <span style={{ fontSize: 12 }}>(Pagamento Único)</span>
            </p>
            {/* QR Code dinâmico do usuário */}
            <div style={{
              background: '#fff', padding: 14, borderRadius: 16, display: 'inline-block',
              marginBottom: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <QRCodeSVG value={pixPayload} size={200} />
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
              <input type="file" style={{ display: 'none' }} accept="application/pdf" onChange={handleFileChange} />
              {comprovanteBase64 ? (
                <>
                  <CheckCircle2 color="var(--roxo-light)" size={40} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: 'var(--texto)', fontWeight: 600 }}>PDF anexado com sucesso!</div>
                  <div style={{ color: 'var(--texto2)', fontSize: 12, marginTop: 6 }}>📄 Comprovante PIX em PDF</div>
                </>
              ) : (
                <>
                  <Upload color="var(--texto2)" size={36} style={{ margin: '0 auto 10px' }} />
                  <div style={{ color: 'var(--texto)', fontWeight: 600, fontSize: 15 }}>Anexar comprovante PIX</div>
                  <div style={{ color: 'var(--texto2)', fontSize: 13, marginTop: 6 }}>Somente PDF (baixe o comprovante no seu banco)</div>
                  <div style={{ color: 'var(--texto2)', fontSize: 11, marginTop: 4, opacity: 0.7 }}>No banco → Comprovante → Compartilhar → Salvar como PDF</div>
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
                  <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 22, letterSpacing: 1 }}>{searchResult.compradorNome || searchResult.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--texto2)' }}>{searchResult.codigo}</div>
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
                    <div style={{ marginBottom: 4 }}><strong style={{ color: 'var(--roxo-light)' }}>C{i+1}:</strong> {s.modelo} · {s.cor} · Tam {s.tamanho} · {s.qtd}x</div>
                    <div style={{ fontSize: 12, color: 'var(--texto2)' }}>Estampa: {s.nome || searchResult.nome} #{s.numero || searchResult.numero}</div>
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
                  { label: 'Total', value: `R$ ${(searchResult.total||0).toFixed(2).replace('.',',')}`, color: 'var(--dourado-light)' },
                  { label: 'Saldo Aberto', value: `R$ ${(searchResult.saldo||0).toFixed(2).replace('.',',')}`, color: searchResult.saldo > 0 ? '#f87171' : '#4ade80' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--cinza2)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--texto2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 24, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {searchResult.saldo > 0 && searchResult.status === 'aprovado' && (
                <div style={{ background: 'rgba(107,33,168,0.15)', border: '1px solid var(--roxo-light)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 16, letterSpacing: 1, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    💸 Pagar parcela restante
                    <span style={{ background: searchResult.parcela2Status === 'analise' ? 'rgba(96,165,250,0.2)' : 'rgba(248,113,113,0.2)', color: searchResult.parcela2Status === 'analise' ? '#60a5fa' : '#f87171', border: `1px solid ${searchResult.parcela2Status === 'analise' ? '#60a5fa' : '#f87171'}`, borderRadius: 12, fontSize: 11, padding: '2px 8px', letterSpacing: 1 }}>
                      {searchResult.parcela2Status === 'analise' ? 'Aguardando' : 'Pendente'}
                    </span>
                  </div>
                  {searchResult.parcela2Status === 'analise' ? (
                    <p style={{ fontSize: 13, color: 'var(--texto2)' }}>Seu comprovante da 2ª parcela foi enviado e está sendo verificado pelo administrador. Assim que aprovado, seu pedido será marcado como <strong>Quitado</strong>.</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--texto2)', marginBottom: 10 }}>Faça o pagamento via PIX e anexe o comprovante abaixo.</p>
                      <div style={{ background: 'var(--cinza2)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 14 }}>
                        <div style={{ background: '#fff', borderRadius: 10, padding: 16, display: 'inline-block', marginBottom: 12 }}>
                          <QRCodeSVG value={gerarPixPayload(PIX_KEY, searchResult.saldo.toString(), searchResult.compradorNome || searchResult.nome || 'PAGADOR')} size={160} />
                        </div>
                        <div style={{ background: 'var(--cinza)', border: '1px solid var(--cinza3)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 14, color: 'var(--dourado-light)', wordBreak: 'break-all', marginBottom: 10 }}>📱 {PIX_KEY}</div>
                        <button className="btn btn-secondary btn-sm" style={{ margin: '0 auto', background: 'var(--roxo)', color: '#fff', border: 'none' }} onClick={() => { navigator.clipboard.writeText(PIX_KEY); alert('Chave Pix copiada!'); }}>Copiar chave PIX</button>
                        <p style={{ fontSize: 12, color: 'var(--texto2)', marginTop: 10 }}>Valor a pagar: <strong style={{ color: 'var(--dourado-light)' }}>R$ {searchResult.saldo.toFixed(2).replace('.',',')}</strong></p>
                      </div>
                      
                      <label style={{ display: 'block', border: `2px dashed ${comprovanteBase64 ? 'var(--roxo-light)' : 'var(--cinza3)'}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: comprovanteBase64 ? 'rgba(124,58,237,0.06)' : 'transparent', transition: 'all 0.25s', marginBottom: 14 }}>
                        <input type="file" style={{ display: 'none' }} accept="application/pdf,image/*" onChange={handleFileChange} />
                        {comprovanteBase64 ? (
                          <>
                            <CheckCircle2 color="var(--roxo-light)" size={30} style={{ margin: '0 auto 8px' }} />
                            <div style={{ color: 'var(--texto)', fontWeight: 600, fontSize: 13 }}>Arquivo anexado!</div>
                          </>
                        ) : (
                          <>
                            <Upload color="var(--texto2)" size={26} style={{ margin: '0 auto 8px' }} />
                            <div style={{ color: 'var(--texto)', fontWeight: 600, fontSize: 13 }}>Anexar comprovante do pagamento</div>
                            <div style={{ color: 'var(--texto2)', fontSize: 11, marginTop: 4 }}>PDF ou Imagem</div>
                          </>
                        )}
                      </label>
                      <button className="btn btn-primary" onClick={async () => {
                        if (!comprovanteBase64) return alert('Anexe o comprovante!');
                        setSearchLoading(true);
                        try {
                          await uploadComprovante2(searchResult.codigo, comprovanteBase64);
                          alert('Comprovante enviado com sucesso!');
                          setComprovanteBase64('');
                          handleSearch(); // reload
                        } catch (e) {
                          alert('Erro ao enviar comprovante: ' + e.message);
                        } finally {
                          setSearchLoading(false);
                        }
                      }} disabled={searchLoading}>
                        {searchLoading ? 'Enviando...' : 'Enviar comprovante da 2ª parcela ✓'}
                      </button>
                    </>
                  )}
                </div>
              )}

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
      
      {/* ─── FOOTER LINK ADMIN (Só aparece no menu principal) ──────────────── */}
      {step === 'menu' && (
        <div 
          onClick={() => routerNavigate('/admin')}
          style={{
            textAlign: 'center', marginTop: 30, paddingBottom: 20, cursor: 'pointer',
            opacity: 0.4, display: 'flex', alignItems: 'center', 
            justifyContent: 'center', gap: 6, fontSize: 11, letterSpacing: 2, 
            textTransform: 'uppercase', color: 'var(--texto)'
          }}
        >
          <Lock size={12} /> Área Restrita
        </div>
      )}

    </div>
    </>
  );
}
