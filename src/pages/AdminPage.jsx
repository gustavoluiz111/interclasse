import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, updateOrderStatus, updateOrderPayment, deleteOrder, deleteAllOrders, updateOrderData, aprovarParcela2, recusarParcela2 } from '../firebase/api';
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
  // Filtrar pedidos válidos (desconsidera recusados)
  const validOrders = orders.filter(o => o.status !== 'recusado');

  // Stats Financeiras Corretas
  const totalPedidos = validOrders.length;
  const totalCamisas = validOrders.reduce((acc, o) => {
    return acc + (o.camisas && o.camisas.length > 0 
      ? o.camisas.reduce((sum, c) => sum + (parseInt(c.qtd) || 1), 0)
      : (parseInt(o.qtd) || 1));
  }, 0);
  
  const totalPrevisto = validOrders.reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);
  const arrecadadoConfirmado = validOrders
    .filter(o => o.status === 'aprovado' || o.status === 'quitado')
    .reduce((acc, o) => acc + (parseFloat(o.valorPago) || 0), 0);
  const arrecadadoAnalise = validOrders
    .filter(o => o.status === 'analise')
    .reduce((acc, o) => acc + (parseFloat(o.valorPago) || 0), 0);
  const aReceber = validOrders.reduce((acc, o) => acc + (parseFloat(o.saldo) || 0), 0);
  const quitados = validOrders.filter(o => o.status === 'quitado').length;

  // Camisas por Status
  const camisasQuitadas = validOrders
    .filter(o => o.status === 'quitado')
    .reduce((acc, o) => acc + (o.camisas && o.camisas.length > 0 
      ? o.camisas.reduce((sum, c) => sum + (parseInt(c.qtd) || 1), 0)
      : (parseInt(o.qtd) || 1)), 0);

  const camisasDevedores = validOrders
    .filter(o => o.status === 'aprovado' && o.saldo > 0)
    .reduce((acc, o) => acc + (o.camisas && o.camisas.length > 0 
      ? o.camisas.reduce((sum, c) => sum + (parseInt(c.qtd) || 1), 0)
      : (parseInt(o.qtd) || 1)), 0);

  const camisasAnalise = validOrders
    .filter(o => o.status === 'analise')
    .reduce((acc, o) => acc + (o.camisas && o.camisas.length > 0 
      ? o.camisas.reduce((sum, c) => sum + (parseInt(c.qtd) || 1), 0)
      : (parseInt(o.qtd) || 1)), 0);

  // Charts Math
  const modelCount = {};
  const numberCount = {};
  const colorCount = {};
  const sizeCount = {};

  validOrders.forEach(o => {
    (o.camisas || []).forEach(c => {
      // Modelos
      const mKey = `${c.modelo} (${c.cor})`;
      modelCount[mKey] = (modelCount[mKey] || 0) + (parseInt(c.qtd) || 1);
      
      // Cores
      colorCount[c.cor] = (colorCount[c.cor] || 0) + (parseInt(c.qtd) || 1);
      
      // Tamanhos
      sizeCount[c.tamanho] = (sizeCount[c.tamanho] || 0) + (parseInt(c.qtd) || 1);

      // Números
      if (c.numero) {
        numberCount[c.numero] = (numberCount[c.numero] || 0) + (parseInt(c.qtd) || 1);
      }
    });

    // Se o pedido for do tipo legacy (sem array camisas)
    if (!o.camisas || o.camisas.length === 0) {
      const q = parseInt(o.qtd) || 1;
      if (o.modelo) {
        const mKey = `${o.modelo} (${o.cor || 'Sem Cor'})`;
        modelCount[mKey] = (modelCount[mKey] || 0) + q;
      }
      if (o.cor) {
        colorCount[o.cor] = (colorCount[o.cor] || 0) + q;
      }
      if (o.tamanho) {
        sizeCount[o.tamanho] = (sizeCount[o.tamanho] || 0) + q;
      }
      if (o.numero) {
        numberCount[o.numero] = (numberCount[o.numero] || 0) + q;
      }
    }
  });

  const modelData = Object.keys(modelCount).map(k => ({ name: k, value: modelCount[k] })).sort((a,b) => b.value - a.value);
  const numberData = Object.keys(numberCount).map(k => ({ name: k, value: numberCount[k] })).sort((a,b) => b.value - a.value).slice(0, 10);
  const colorData = Object.keys(colorCount).map(k => ({ name: k, value: colorCount[k] })).sort((a,b) => b.value - a.value);
  
  const sizeOrdem = ['PP', 'P', 'M', 'G', 'GG', 'XG', '4A', '6A', '8A', '10A', '12A'];
  const sizeData = Object.keys(sizeCount).map(k => ({ name: k, value: sizeCount[k] })).sort((a, b) => {
    const idxA = sizeOrdem.indexOf(a.name);
    const idxB = sizeOrdem.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  const COLORS = ['#9333EA', '#DB2777', '#F59E0B', '#3B82F6', '#10B981', '#6366F1'];

  // Função para copiar Relatório do WhatsApp
  const handleCopyWhatsappReport = () => {
    const reportText = [
      `📊 *RELATÓRIO DE VENDAS & FINANCEIRO* 📊`,
      `================================`,
      `📅 Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
      ``,
      `💰 *FINANÇAS GERAIS:*`,
      `💵 Previsto Total: R$ ${totalPrevisto.toFixed(2).replace('.', ',')}`,
      `🟢 Confirmado Caixa: R$ ${arrecadadoConfirmado.toFixed(2).replace('.', ',')}`,
      `🟡 Em Análise (PIX): R$ ${arrecadadoAnalise.toFixed(2).replace('.', ',')}`,
      `🔴 Restante a Receber: R$ ${aReceber.toFixed(2).replace('.', ',')}`,
      ``,
      `👕 *PRODUÇÃO & STATUS:*`,
      `📦 Total de Pedidos: ${totalPedidos}`,
      `👕 Total de Camisas: ${totalCamisas} unidades`,
      `   • Pagas (Quitadas): ${camisasQuitadas} un.`,
      `   • Devedores (Com Saldo): ${camisasDevedores} un.`,
      `   • Em Análise (PIX): ${camisasAnalise} un.`,
      ``,
      `📂 *POR MODELO:*`,
      ...modelData.map(m => `  • ${m.name.padEnd(16)}: ${m.value} camisa(s)`),
      ``,
      `🎨 *POR COR:*`,
      ...colorData.map(c => `  • ${c.name.padEnd(12)}: ${c.value} unidade(s)`),
      ``,
      `📐 *POR TAMANHO:*`,
      ...sizeData.map(s => `  • ${s.name.padEnd(8)}: ${s.value} unidade(s)`),
      `================================`
    ].join('\n');

    navigator.clipboard.writeText(reportText)
      .then(() => alert("✓ Relatório copiado para a área de transferência!"))
      .catch(() => alert("Erro ao copiar. Tente novamente."));
  };

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
        <button className={tab === 'devedores' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab('devedores')}>Devedores</button>
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

      {tab === 'devedores' && (
        <div className="animate-fade-in">
          {(() => {
            const devedores = orders.filter(p => p.saldo > 0 && p.status === 'aprovado');
            const totalDevido = devedores.reduce((s, p) => s + p.saldo, 0);
            const pendentes2 = orders.filter(p => p.parcela2Status === 'analise' && p.comprovante2Url);

            return (
              <>
                <div className="card" style={{ marginBottom: 12 }}>
                  <h2 className="card-title"><div className="dot" /> Lista de Devedores</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 32, color: '#f87171' }}>{devedores.length}</div>
                      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--texto2)', marginTop: 4 }}>Devedores</div>
                    </div>
                    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 28, color: '#f87171' }}>R${totalDevido.toFixed(2).replace('.',',')}</div>
                      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--texto2)', marginTop: 4 }}>Total em aberto</div>
                    </div>
                  </div>
                  
                  {devedores.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 20, color: 'var(--texto2)' }}>✅ Nenhum devedor! Todos quitados.</p>
                  ) : (
                    <div>
                      {devedores.map(p => (
                        <div key={p.id} style={{ background: 'var(--cinza2)', border: '1px solid #7f1d1d', borderRadius: 10, padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 16, letterSpacing: 0.5 }}>{p.compradorNome || p.nome} <span style={{ color: 'var(--texto2)', fontWeight: 400 }}>#{p.numero}</span></div>
                            <div style={{ fontSize: 11, color: 'var(--texto2)', marginTop: 2 }}>{p.codigo} · {p.camisas?.[0]?.tamanho || p.tamanho} · {p.camisas?.[0]?.modelo || p.modelo}</div>
                            <div style={{ marginTop: 6 }}>
                              <span className="status-badge" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid #b91c1c' }}>
                                {p.parcela2Status === 'analise' ? 'Comprovante enviado' : 'Aguardando pagamento'}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--fonte-display)', fontSize: 24, color: '#f87171' }}>R${p.saldo.toFixed(2).replace('.',',')}</div>
                            <div style={{ fontSize: 11, color: 'var(--texto2)', letterSpacing: 1, textTransform: 'uppercase' }}>em aberto</div>
                            {p.parcela2Status === 'analise' ? (
                              <button className="btn btn-success btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={async () => {
                                await aprovarParcela2(p.id);
                                loadData();
                                alert('✓ 2ª parcela aprovada! Pedido quitado.');
                              }}>✓ Aprovar pgto</button>
                            ) : (
                              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => registrarPagamento(p)}>+ Reg. pgto</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                  <h2 className="card-title" style={{ color: '#60a5fa' }}><div className="dot" style={{ background: '#60a5fa' }} />Comprovantes 2ª Parcela — Aguardando aprovação</h2>
                  {pendentes2.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: 16, color: 'var(--texto2)', fontSize: 13 }}>Nenhum comprovante pendente no momento.</p>
                  ) : (
                    <div>
                      {pendentes2.map(p => (
                        <div key={p.id} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid #60a5fa', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div>
                              <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 15 }}>{p.compradorNome || p.nome} <span style={{ color: 'var(--texto2)' }}>#{p.numero}</span></div>
                              <div style={{ fontSize: 12, color: 'var(--texto2)', marginTop: 2 }}>{p.codigo} · Saldo: <strong style={{ color: '#f87171' }}>R$ {p.saldo.toFixed(2).replace('.',',')}</strong></div>
                            </div>
                            <span style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid #60a5fa', borderRadius: 12, fontSize: 11, padding: '2px 8px', letterSpacing: 1 }}>Aguardando</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                              if (p.comprovante2Url.startsWith('data:application/pdf') || p.comprovante2Url.startsWith('data:application/octet')) {
                                const blob = new Blob(
                                  [Uint8Array.from(atob(p.comprovante2Url.split(',')[1]), c => c.charCodeAt(0))],
                                  { type: 'application/pdf' }
                                );
                                window.open(URL.createObjectURL(blob), '_blank');
                              } else {
                                setViewingComprovante(p.comprovante2Url);
                              }
                            }}>
                              {p.comprovante2Url.startsWith('data:application') ? '📑 Ver PDF' : '🖼️ Ver Imagem'}
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--texto2)' }}>ver comprovante anexado</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button className="btn btn-success btn-sm" onClick={async () => {
                                await aprovarParcela2(p.id);
                                loadData();
                                alert('✓ 2ª parcela aprovada! Pedido quitado.');
                            }}>✓ Aprovar</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                                await recusarParcela2(p.id);
                                loadData();
                                alert('Comprovante da 2ª parcela recusado.');
                            }}>✗ Recusar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Seção Financeira */}
          <div>
            <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 13, letterSpacing: 1, color: 'var(--texto2)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--dourado-light)' }}>💵</span> Resumo Financeiro Geral
            </div>
            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(107,33,168,0.1))', border: '1px solid rgba(217,119,6,0.2)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: 'var(--dourado-light)' }}>R$ {totalPrevisto.toFixed(2).replace('.', ',')}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Previsto Total</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, background: 'linear-gradient(135deg, rgba(74,222,128,0.06), rgba(22,163,74,0.1))', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#4ade80' }}>R$ {arrecadadoConfirmado.toFixed(2).replace('.', ',')}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Arrecadado Confirmado</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(29,78,216,0.1))', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#60a5fa' }}>R$ {arrecadadoAnalise.toFixed(2).replace('.', ',')}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Em Análise (PIX)</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, background: 'linear-gradient(135deg, rgba(248,113,113,0.06), rgba(185,28,28,0.1))', border: '1px solid rgba(248,113,113,0.2)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#f87171' }}>R$ {aReceber.toFixed(2).replace('.', ',')}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Saldo Restante</div>
              </div>
            </div>
          </div>

          {/* Seção Produção */}
          <div>
            <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 13, letterSpacing: 1, color: 'var(--texto2)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--roxo-light)' }}>👕</span> Estatísticas de Camisas
            </div>
            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: 'var(--dourado-light)' }}>{totalPedidos}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Pedidos Válidos</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, border: '1px solid rgba(147,51,234,0.2)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#a78bfa' }}>{totalCamisas}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Total de Camisas</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.04)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#4ade80' }}>{camisasQuitadas}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Camisas Pagas</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#f87171' }}>{camisasDevedores}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Devedores</div>
              </div>
              <div className="card" style={{ textAlign: 'center', marginBottom: 0, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.04)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 36, fontFamily: 'var(--fonte-display)', color: '#fbbf24' }}>{camisasAnalise}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--texto2)', marginTop: 4 }}>Em Análise (aguardando aprovação)</div>
              </div>
            </div>
          </div>

          {/* Gráficos Grid */}
          <div className="grid-2" style={{ gap: 12 }}>
            {/* Pie Chart: Modelos */}
            <div className="card" style={{ marginBottom: 0 }}>
               <h3 className="card-title" style={{ fontSize: 13 }}><div className="dot" /> Modelos Pedidos</h3>
               {modelData.length > 0 ? (
                 <div style={{ width: '100%', height: 260 }}>
                   <ResponsiveContainer>
                     <PieChart>
                       <Pie data={modelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8" label={({name, value}) => `${name.split(' ')[0]}: ${value}`}>
                         {modelData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                       </Pie>
                       <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p style={{color: 'var(--texto2)'}}>Sem dados</p>}
            </div>

            {/* Bar Chart: Cores */}
            <div className="card" style={{ marginBottom: 0 }}>
               <h3 className="card-title" style={{ fontSize: 13 }}><div className="dot" /> Camisas por Cor</h3>
               {colorData.length > 0 ? (
                 <div style={{ width: '100%', height: 260 }}>
                   <ResponsiveContainer>
                     <BarChart data={colorData} layout="vertical" margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                       <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                       <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={5} width={60} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                       <Bar dataKey="value" fill="#EC4899" radius={[0,4,4,0]} name="Camisas">
                         {colorData.map((entry, index) => {
                           const dots = { Roxa: '#6B21A8', Rosa: '#EC4899', Preta: '#333', Azul: '#1D4ED8', Dourada: '#D97706', Branca: '#FAFAFA' };
                           return <Cell key={`cell-${index}`} fill={dots[entry.name] || '#888'} />;
                         })}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p style={{color: 'var(--texto2)'}}>Sem dados</p>}
            </div>

            {/* Bar Chart: Tamanhos */}
            <div className="card" style={{ marginBottom: 0 }}>
               <h3 className="card-title" style={{ fontSize: 13 }}><div className="dot" /> Demanda por Tamanho</h3>
               {sizeData.length > 0 ? (
                 <div style={{ width: '100%', height: 260 }}>
                   <ResponsiveContainer>
                     <BarChart data={sizeData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                       <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                       <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                       <Bar dataKey="value" fill="#3B82F6" radius={[4,4,0,0]} name="Camisas" />
                     </BarChart>
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
                       <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                       <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                       <Bar dataKey="value" fill="#F59E0B" radius={[4,4,0,0]} name="Pedidos" />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p style={{color: 'var(--texto2)'}}>Sem dados</p>}
            </div>
          </div>

          {/* Relatório WhatsApp */}
          <div className="card" style={{ border: '1px solid var(--dourado)', background: 'rgba(217,119,6,0.03)' }}>
            <h3 className="card-title" style={{ color: 'var(--dourado-light)' }}><div className="dot" style={{ background: 'var(--dourado)' }} /> Relatório Resumido para WhatsApp</h3>
            <p style={{ color: 'var(--texto2)', fontSize: 12, marginBottom: 12 }}>Copie o relatório financeiro e estatístico estruturado com um único clique para enviar no grupo da classe.</p>
            <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, var(--dourado), var(--dourado-light))', color: '#000', fontWeight: 'bold' }} onClick={handleCopyWhatsappReport}>
               📋 Copiar Relatório Completo
            </button>
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
