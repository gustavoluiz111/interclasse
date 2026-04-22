import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, updateOrderStatus, updateOrderPayment, deleteOrder, deleteAllOrders, updateOrderData } from '../firebase/api';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { RefreshCcw, LogOut, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pedidos');
  const [filter, setFilter] = useState('todos');
  const [viewingComprovante, setViewingComprovante] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchOrders();
    // Sort by newest first
    setOrders(data.sort((a,b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin');
    } catch(err) {
      console.error('Erro ao deslogar', err);
    }
  };

  const aprovar = async (id) => {
    if (!window.confirm("Aprovar pedido?")) return;
    await updateOrderStatus(id, 'aprovado', 'Pagamento aprovado pelo admin');
    await loadData();
  };

  const recusar = async (id) => {
    if (!window.confirm("Recusar pedido? O comprovante será rejeitado.")) return;
    await updateOrderStatus(id, 'recusado', 'Comprovante recusado — envie outro');
    await loadData();
  };

  const recolocarEmAnalise = async (id) => {
    if (!window.confirm("Recolocar pedido em análise?")) return;
    await updateOrderStatus(id, 'analise', 'Pedido recolocado em análise pelo admin');
    await loadData();
  };

  const registrarPagamento = async (order) => {
    const val = prompt(`Registrar pagamento para ${order.nome}\nSaldo aberto: R$ ${order.saldo.toFixed(2)}\nValor recebido (R$):`, order.saldo.toFixed(2));
    if (!val) return;
    const v = parseFloat(val.replace(',', '.'));
    if (isNaN(v) || v <= 0) return alert("Valor inválido");
    await updateOrderPayment(order.id, v);
    alert("Pagamento registrado!");
    loadData();
  };

  const apagar = async (id) => {
    if (!window.confirm("ATENÇÃO: Deseja EXCLUIR definitivamente este pedido? Esta ação não pode ser desfeita.")) return;
    await deleteOrder(id);
    loadData();
  };

  const apagarTodos = async () => {
    if (!window.confirm("PERIGO: Deseja APAGAR TODOS os pedidos do banco de dados?")) return;
    const pwd = prompt("Digite a senha de administrador para confirmar a exclusão de tudo:");
    if (pwd !== '121415gugu' && pwd !== 'asaph') return alert("Senha incorreta. Ação cancelada.");
    await deleteAllOrders();
    loadData();
  };

  const startEditing = (order) => {
    setEditingOrder(order.id);
    setEditFormData(JSON.parse(JSON.stringify(order))); // deep copy
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditCamisaChange = (index, field, value) => {
    const newCamisas = [...(editFormData.camisas || [])];
    newCamisas[index] = { ...newCamisas[index], [field]: value };
    setEditFormData(prev => ({ ...prev, camisas: newCamisas }));
  };

  const saveEdit = async () => {
    try {
        const payload = { ...editFormData };
        delete payload.id;
        payload.total = parseFloat(payload.total) || 0;
        payload.valorPago = parseFloat(payload.valorPago) || 0;
        payload.saldo = (payload.total - payload.valorPago) || 0;
        
        await updateOrderData(editingOrder, payload);
        alert("Pedido editado com sucesso!");
        setEditingOrder(null);
        loadData();
    } catch(err) {
        alert("Erro ao editar: " + err.message);
    }
  };

  const exportCSV = () => {
    const header = 'Código,Comprador,WhatsApp,Email,Jogador(Legacy),Número(Legacy),Status,Data\n';
    const rows = orders.map(p => 
      `${p.codigo},"${p.compradorNome || ''}","${p.compradorTelefone || ''}","${p.compradorEmail || ''}","${p.nome || ''}",${p.numero || ''},${p.status},${p.data}`
    ).join('\n');
    
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `interclasse_pedidos_${new Date().getTime()}.csv`;
    link.click();
  };

  const exportProductionCSV = () => {
    const header = 'Pedido,Jogador,Número,Modelo,Cor,Tamanho,Qtd\n';
    const rows = orders
      .filter(o => o.status === 'aprovado' || o.status === 'quitado')
      .flatMap(o => (o.camisas || []).map(c => 
        `${o.codigo},"${c.nome || o.nome || ''}",${c.numero || o.numero || ''},${c.modelo},${c.cor},${c.tamanho},${c.qtd}`
      ))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabela_producao_${new Date().getTime()}.csv`;
    link.click();
  };

  const filteredOrders = filter === 'todos' ? orders : orders.filter(o => o.status === filter);

  // Stats
  const arrecadado = orders.reduce((acc, o) => acc + o.valorPago, 0);
  const aReceber = orders.reduce((acc, o) => acc + o.saldo, 0);

  // Charts Math
  const modelCount = {};
  const numberCount = {};
  orders.forEach(o => {
    (o.camisas || []).forEach(c => {
      const key = `${c.modelo} (${c.cor})`;
      modelCount[key] = (modelCount[key] || 0) + (parseInt(c.qtd) || 1);
      if (c.numero) {
        numberCount[c.numero] = (numberCount[c.numero] || 0) + (parseInt(c.qtd) || 1);
      }
    });
  });

  const modelData = Object.keys(modelCount).map(k => ({ name: k, value: modelCount[k] })).sort((a,b) => b.value - a.value);
  const numberData = Object.keys(numberCount).map(k => ({ name: k, value: numberCount[k] })).sort((a,b) => b.value - a.value).slice(0, 10);
  const COLORS = ['#9333EA', '#DB2777', '#F59E0B', '#3B82F6', '#10B981', '#6366F1'];

  return (
    <div className="container" style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #3b0764, #1e1b4b)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ background: 'var(--dourado)', display: 'inline-block', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', color: '#000', letterSpacing: 1 }}>SISTEMA ASAPH</div>
          <div style={{ color: '#a78bfa', fontSize: 13, marginTop: 4 }}>Painel Administrativo</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}><RefreshCcw size={16} /></button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}><LogOut size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 5 }}>
        <button className={tab === 'pedidos' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('pedidos')}>Lista de Pedidos</button>
        <button className={tab === 'grafica' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('grafica')}>Tabela Produção</button>
        <button className={tab === 'dashboard' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('dashboard')}>Dashboard & Stats</button>
        <button className={tab === 'export' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('export')}>Exportar Dados</button>
      </div>

      {tab === 'pedidos' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 5, alignItems: 'center' }}>
            {['todos', 'analise', 'aprovado', 'quitado', 'recusado'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className="btn btn-secondary btn-sm" 
                style={{ borderColor: filter === f ? 'var(--dourado)' : 'var(--cinza3)', color: filter === f ? 'var(--dourado)' : 'var(--texto2)' }}
              >
                {f.toUpperCase()}
              </button>
            ))}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={apagarTodos}>LIXEIRA (Apagar Tudo)</button>
          </div>

          {loading ? <p style={{ textAlign: 'center', padding: 40, color: 'var(--texto2)' }}>Carregando pedidos...</p> : 
           filteredOrders.length === 0 ? <p style={{ textAlign: 'center', padding: 40, color: 'var(--texto2)' }}>Nenhum pedido encontrado.</p> :
           filteredOrders.map(o => (
            <div key={o.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 18, letterSpacing: 0.5 }}>{o.compradorNome || o.nome} {o.numero && <span style={{ color: 'var(--texto2)', fontWeight: 'normal' }}>#{o.numero}</span>}</div>
                  <div style={{ fontSize: 13, color: 'var(--texto2)' }}>{o.codigo} · {o.data}</div>
                  {o.compradorNome && (
                    <div style={{ fontSize: 12, color: 'var(--dourado-light)', marginTop: 8, background: 'rgba(212,175,55,0.05)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(212,175,55,0.2)' }}>
                      <strong>👤 Comprador:</strong> {o.compradorNome} <br/> 
                      <strong>📞 Whats:</strong> {o.compradorTelefone} <span style={{margin: '0 4px', opacity: 0.5}}>|</span> <strong>✉️ Email:</strong> {o.compradorEmail}
                    </div>
                  )}
                </div>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
              
              <div className="grid-2" style={{ gap: 8, fontSize: 13, background: 'var(--cinza2)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                   {o.camisas?.map((c, i) => (
                      <div key={i} style={{ borderBottom: i < o.camisas.length - 1 ? '1px solid var(--cinza3)' : 'none', paddingBottom: i < o.camisas.length - 1 ? 6 : 0, marginBottom: i < o.camisas.length - 1 ? 6 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                           <strong>{c.qtd}x {c.modelo} ({c.cor})</strong>
                           <span style={{ color: 'var(--texto2)' }}>Tam {c.tamanho}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--texto2)' }}>Estampa: <span style={{ color: '#fff' }}>{c.nome || o.nome}</span> #{c.numero || o.numero}</div>
                      </div>
                   ))}
                </div>
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Total / Pago</span> <strong style={{ color: 'var(--dourado-light)' }}>R$ {o.total.toFixed(2)} / R$ {o.valorPago.toFixed(2)}</strong></div>
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Saldo Aberto</span> <strong style={{ color: o.saldo > 0 ? '#f87171' : '#4ade80' }}>R$ {o.saldo.toFixed(2)}</strong></div>
              </div>

              {/* Aviso: sem comprovante */}
              {(!o.comprovanteUrl || o.comprovanteAnexado === false) && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fca5a5',
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Sem comprovante de pagamento</strong> — o cliente não anexou ou o upload falhou.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(o.status === 'analise') && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => aprovar(o.id)}>✓ Aprovar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => recusar(o.id)}>✗ Recusar</button>
                  </>
                )}
                {o.status === 'recusado' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => aprovar(o.id)} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid #4ade80', color: '#4ade80' }}>✓ Aprovar mesmo assim</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => recolocarEmAnalise(o.id)} style={{ borderColor: '#F59E0B', color: '#F59E0B' }}>⏳ Recolocar em Análise</button>
                  </>
                )}
                {o.status === 'aprovado' && o.saldo > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={() => registrarPagamento(o)}>+ Registrar Pagamento</button>
                )}
                
                {o.comprovanteUrl && o.comprovanteUrl.startsWith('data:') && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: 'var(--roxo-light)', color: 'var(--roxo-light)' }}
                    onClick={() => {
                      if (o.comprovanteUrl.startsWith('data:application/pdf') || o.comprovanteUrl.startsWith('data:application/octet')) {
                        const blob = new Blob(
                          [Uint8Array.from(atob(o.comprovanteUrl.split(',')[1]), c => c.charCodeAt(0))],
                          { type: 'application/pdf' }
                        );
                        window.open(URL.createObjectURL(blob), '_blank');
                      } else {
                        setViewingComprovante(o.comprovanteUrl);
                      }
                    }}
                  >
                    {o.comprovanteUrl.startsWith('data:application') ? '📑 Ver PDF' : '🖼️ Ver Imagem'}
                  </button>
                )}
                {o.comprovanteUrl && !o.comprovanteUrl.startsWith('data:') && o.comprovanteAnexado !== false && (
                  <span style={{ fontSize: 12, color: 'var(--dourado-light)', padding: '6px 0' }}>Comprovante registrado (sem prévia)</span>
                )}
                
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 'auto', marginRight: 8, borderColor: '#a855f7', color: '#a855f7' }}
                  onClick={() => startEditing(o)}
                >
                  ✏️ Editar
                </button>
                <button 
                  className="btn btn-danger btn-sm" 
                  style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }} 
                  onClick={() => apagar(o.id)}
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
           ))}
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="animate-fade-in">
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: '#4ade80' }}>R$ {arrecadado.toFixed(0)}</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Total Arrecadado</div>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: '#f87171' }}>R$ {aReceber.toFixed(0)}</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>A Receber (Saldo)</div>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: 'var(--dourado-light)' }}>{orders.length}</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Qtd de Pedidos</div>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)' }}>{orders.filter(o => o.status === 'quitado').length}</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Pedidos Quitados</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Pie Chart: Modelos */}
            <div className="card" style={{ marginBottom: 0 }}>
               <h3 className="card-title" style={{ fontSize: 13 }}><div className="dot" /> Modelos Mais Pedidos</h3>
               {modelData.length > 0 ? (
                 <div style={{ width: '100%', height: 260 }}>
                   <ResponsiveContainer>
                     <PieChart>
                       <Pie data={modelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8" label={({name, value}) => `${name}: ${value}`}>
                         {modelData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                       </Pie>
                       <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p style={{color: 'var(--texto2)'}}>Sem dados</p>}
            </div>

            {/* Bar Chart: Numeros */}
            <div className="card" style={{ marginBottom: 0 }}>
               <h3 className="card-title" style={{ fontSize: 13 }}><div className="dot" /> Top 10 Números</h3>
               {numberData.length > 0 ? (
                 <div style={{ width: '100%', height: 260 }}>
                   <ResponsiveContainer>
                     <BarChart data={numberData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                       <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickMargin={10} />
                       <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} allowDecimals={false} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                       <Bar dataKey="value" fill="#F59E0B" radius={[4,4,0,0]} name="Pedidos" />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p style={{color: 'var(--texto2)'}}>Sem dados</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div className="animate-fade-in card">
          <h2 className="card-title"><div className="dot" /> Exportar Dados</h2>
          <p style={{ color: 'var(--texto2)', fontSize: 14, marginBottom: 20 }}>Gere planilhas atualizadas do sistema para controle contábil.</p>
          
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, padding: 20 }} onClick={exportCSV}>
             <Download size={28} color="var(--dourado)" />
             <div style={{ textAlign: 'left' }}>
               <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 18, color: 'var(--texto)' }}>Planilha Completa CSV</div>
               <div style={{ fontSize: 13, color: 'var(--texto2)' }}>Abre no Excel, Google Sheets, etc.</div>
             </div>
          </button>
        </div>
      )}

      {tab === 'grafica' && (
        <div className="animate-fade-in card" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: 4 }}><div className="dot" /> Tabela de Produção (Gráfica)</h2>
              <p style={{ color: 'var(--texto2)', fontSize: 13 }}>
                Lista detalhada das camisas aprovadas/quitadas.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" style={{ padding: '8px 16px', background: 'var(--dourado)', color: '#000', border: '1px solid var(--dourado-light)' }} onClick={exportProductionCSV}>
              <Download size={16} /> Baixar CSV para Gráfica
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--cinza)', borderBottom: '2px solid var(--roxo-light)' }}>
                <th style={{ padding: 12 }}>Pedido</th>
                <th style={{ padding: 12 }}>Jogador / Estampa</th>
                <th style={{ padding: 12 }}>Número</th>
                <th style={{ padding: 12 }}>Modelo</th>
                <th style={{ padding: 12 }}>Cor</th>
                <th style={{ padding: 12 }}>Tam</th>
                <th style={{ padding: 12 }}>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter(o => o.status === 'aprovado' || o.status === 'quitado')
                .map(o => (
                  <React.Fragment key={o.id}>
                    {(o.camisas || []).map((c, idx) => (
                      <tr key={`${o.id}-${idx}`} style={{ borderBottom: '1px solid var(--cinza3)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--texto2)' }}>{o.codigo}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{c.nome || o.nome}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--roxo-light)' }}>{c.numero || o.numero}</td>
                        <td style={{ padding: '10px 12px' }}>{c.modelo}</td>
                        <td style={{ padding: '10px 12px' }}>{c.cor}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{c.tamanho}</td>
                        <td style={{ padding: '10px 12px' }}>{c.qtd}</td>
                      </tr>
                    ))}
                  </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Comprovante (Imagem) */}
      {viewingComprovante && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            flexDirection: 'column', gap: 16,
          }}
          onClick={() => setViewingComprovante(null)}
        >
          <button
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', padding: '8px 20px', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'var(--fonte-cond)', letterSpacing: 2,
            }}
            onClick={() => setViewingComprovante(null)}
          >
            FECHAR ✕
          </button>
          <div
            style={{ position: 'relative', maxWidth: '100%', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={viewingComprovante}
              alt="Comprovante"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, border: '2px solid var(--roxo-light)', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingOrder && editFormData && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}
          onClick={() => setEditingOrder(null)}
        >
          <div
            style={{
              background: 'var(--fundo)', border: '1px solid var(--roxo-light)', borderRadius: 12,
              padding: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: 'var(--fonte-cond)', marginBottom: 20, color: 'var(--dourado)' }}>Editar Pedido</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Nome do Comprador</label>
                <input className="input" style={{ width: '100%' }} value={editFormData.compradorNome || ''} onChange={e => handleEditChange('compradorNome', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Telefone</label>
                <input className="input" style={{ width: '100%' }} value={editFormData.compradorTelefone || ''} onChange={e => handleEditChange('compradorTelefone', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Email</label>
                <input className="input" style={{ width: '100%' }} value={editFormData.compradorEmail || ''} onChange={e => handleEditChange('compradorEmail', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Status</label>
                <select className="input" style={{ width: '100%' }} value={editFormData.status || ''} onChange={e => handleEditChange('status', e.target.value)}>
                    <option value="analise">Em Análise</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="quitado">Quitado</option>
                    <option value="recusado">Recusado</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Total (R$)</label>
                <input className="input" type="number" step="0.01" style={{ width: '100%' }} value={editFormData.total || 0} onChange={e => handleEditChange('total', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--texto2)' }}>Pago (R$)</label>
                <input className="input" type="number" step="0.01" style={{ width: '100%' }} value={editFormData.valorPago || 0} onChange={e => handleEditChange('valorPago', e.target.value)} />
              </div>
            </div>

            {/* Camisas loop */}
            <h3 style={{ fontSize: 14, color: 'var(--dourado-light)', marginBottom: 10, marginTop: 20 }}>Editar Camisas</h3>
            {(editFormData.camisas || []).map((c, i) => (
              <div key={i} style={{ border: '1px solid var(--cinza3)', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--texto2)' }}>Nome nas Costas</label>
                    <input className="input" style={{ width: '100%' }} value={c.nome || ''} onChange={e => handleEditCamisaChange(i, 'nome', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--texto2)' }}>Número</label>
                    <input className="input" style={{ width: '100%' }} value={c.numero || ''} onChange={e => handleEditCamisaChange(i, 'numero', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--texto2)' }}>Tamanho</label>
                    <input className="input" style={{ width: '100%' }} value={c.tamanho || ''} onChange={e => handleEditCamisaChange(i, 'tamanho', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--texto2)' }}>Quantidade</label>
                    <input className="input" type="number" style={{ width: '100%' }} value={c.qtd || ''} onChange={e => handleEditCamisaChange(i, 'qtd', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit}>Salvar Alterações</button>
              <button className="btn btn-secondary" onClick={() => setEditingOrder(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
