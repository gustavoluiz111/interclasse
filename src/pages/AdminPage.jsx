import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, updateOrderStatus, updateOrderPayment, deleteOrder, deleteAllOrders } from '../firebase/api';
import { RefreshCcw, LogOut, Download, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pedidos');
  const [filter, setFilter] = useState('todos');
  const [viewingComprovante, setViewingComprovante] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('admin_asaph_auth')) {
      navigate('/admin');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchOrders();
    // Sort by newest first
    setOrders(data.sort((a,b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_asaph_auth');
    navigate('/admin');
  };

  const aprovar = async (id) => {
    if (!window.confirm("Aprovar pedido?")) return;
    await updateOrderStatus(id, 'aprovado', 'Pagamento aprovado pelo admin');
    loadData();
  };

  const recusar = async (id) => {
    if (!window.confirm("Recusar pedido? O comprovante será rejeitado.")) return;
    await updateOrderStatus(id, 'recusado', 'Comprovante recusado — envie outro');
    loadData();
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

  const exportCSV = () => {
    const header = 'Código,Comprador,WhatsApp,Email,Jogador,Número,Tamanho,Modelo,Cor,Qtd,Total(R$),Pago(R$),Saldo(R$),Status,Data\n';
    const rows = orders.map(p => 
      `${p.codigo},"${p.compradorNome || ''}","${p.compradorTelefone || ''}","${p.compradorEmail || ''}","${p.nome}",${p.numero},${p.tamanho},${p.modelo},${p.cor},${p.qtd},${p.total},${p.valorPago},${p.saldo},${p.status},${p.data}`
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
        `${o.codigo},"${o.nome}",${o.numero},${c.modelo},${c.cor},${c.tamanho},${c.qtd}`
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
                  <div style={{ fontFamily: 'var(--fonte-cond)', fontSize: 18, letterSpacing: 0.5 }}>{o.nome} <span style={{ color: 'var(--texto2)', fontWeight: 'normal' }}>#{o.numero}</span></div>
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
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Modelo / Cor</span> <strong>{o.modelo} · {o.cor}</strong></div>
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Tam / Qtd</span> <strong>{o.tamanho} · {o.qtd} un</strong></div>
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Total / Pago</span> <strong style={{ color: 'var(--dourado-light)' }}>R$ {o.total.toFixed(2)} / R$ {o.valorPago.toFixed(2)}</strong></div>
                <div><span style={{ color: 'var(--texto2)', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Saldo Aberto</span> <strong style={{ color: o.saldo > 0 ? '#f87171' : '#4ade80' }}>R$ {o.saldo.toFixed(2)}</strong></div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {o.status === 'analise' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => aprovar(o.id)}>✓ Aprovar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => recusar(o.id)}>✗ Recusar</button>
                  </>
                )}
                {o.status === 'aprovado' && o.saldo > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={() => registrarPagamento(o)}>+ Registrar Pagamento</button>
                )}
                
                {o.comprovanteUrl && o.comprovanteUrl.startsWith('data:image') && (
                  <button className="btn btn-secondary btn-sm" style={{borderColor: 'var(--roxo-light)', color: 'var(--roxo-light)'}} onClick={() => setViewingComprovante(o.comprovanteUrl)}>
                    📄 Ver Comprovante
                  </button>
                )}
                {o.comprovanteUrl && !o.comprovanteUrl.startsWith('data:image') && o.comprovanteAnexado !== false && (
                   <span style={{fontSize: 12, color: 'var(--dourado-light)', padding: '6px 0'}}>Possui comprovante (PDF/Local)</span>
                )}
                
                <button 
                  className="btn btn-danger btn-sm" 
                  style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }} 
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
        <div className="animate-fade-in grid-2">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: '#4ade80' }}>R$ {arrecadado.toFixed(0)}</div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Total Arrecadado</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: '#f87171' }}>R$ {aReceber.toFixed(0)}</div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>A Receber (Saldo)</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)', color: 'var(--dourado-light)' }}>{orders.length}</div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Qtd de Pedidos</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontFamily: 'var(--fonte-display)' }}>{orders.filter(o => o.status === 'quitado').length}</div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--texto2)' }}>Pedidos Quitados</div>
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
                        <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{o.nome}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--roxo-light)' }}>{o.numero}</td>
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

      {/* Modal de Comprovante */}
      {viewingComprovante && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setViewingComprovante(null)}>
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
            <button style={{
              position: 'absolute', top: -40, right: 0, background: 'none', border: 'none',
              color: '#fff', fontSize: 16, cursor: 'pointer', fontFamily: 'var(--fonte-cond)'
            }}>FECHAR ✕</button>
            <img src={viewingComprovante} alt="Comprovante" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, border: '2px solid var(--roxo-light)' }} />
          </div>
        </div>
      )}

    </div>
  );
}
