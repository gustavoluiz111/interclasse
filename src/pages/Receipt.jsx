import React from 'react';
import { Download, X, Printer } from 'lucide-react';

// Model label map
const MODEL_LABELS = {
  Casa: 'Camisa Casa',
  Fora: 'Camisa Fora',
  Goleiro: 'Camisa Goleiro',
  Alternativa: 'Camisa Extra',
};

export default function Receipt({ order, onClose }) {
  const handlePrint = () => window.print();

  const handleDownload = () => {
    const card = document.getElementById('receipt-card');
    if (!card) return;
    // Use the built-in print to PDF trick on mobile-friendly layout
    window.print();
  };

  const {
    nome, numero, codigo, data, status,
    camisas, modelo, cor, tamanho, qtd,
    pagamento, total, valorPago, saldo,
  } = order;

  const totalQtd = camisas
    ? camisas.reduce((a, s) => a + (parseInt(s.qtd) || 1), 0)
    : (parseInt(qtd) || 1);

  const statusDisplay = {
    analise:  '⏳ Em Análise',
    aprovado: '✅ Aprovado',
    quitado:  '✅ Quitado',
    recusado: '❌ Recusado',
  }[status] || status;

  return (
    <div className="receipt-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="receipt-wrapper">

        {/* ── Action Buttons ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={handlePrint}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 10, padding: '10px 16px',
              cursor: 'pointer', fontFamily: 'Barlow Condensed', fontSize: 14,
              textTransform: 'uppercase', letterSpacing: 2, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}
          >
            <Printer size={16} /> Salvar / Imprimir
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171', borderRadius: 10, padding: '10px 14px',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Receipt Card ─────────────────────────────────────────────────── */}
        <div id="receipt-card">

          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-logo-badge">3º ANO EM · 2025</div>
            <div className="receipt-title">CAMISAS</div>
            <div className="receipt-title" style={{ fontSize: 32, letterSpacing: 2, opacity: 0.9, color: '#f0d0ff' }}>
              INTERCLASSE
            </div>
            <div className="receipt-subtitle">Comprovante de Pedido</div>

            {/* Tear notch */}
            <div className="receipt-notch" style={{ marginTop: 20 }}>
              <div className="receipt-notch-line" />
            </div>
            <div className="receipt-code-bar">{codigo}</div>
          </div>

          {/* Body */}
          <div className="receipt-body">

            {/* Customer Details */}
            <div className="receipt-section-title">Dados do Aluno (Responsável)</div>
            <div className="receipt-row">
              <span className="receipt-label">Nome</span>
              <span className="receipt-value">{order.compradorNome || nome}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Telefone</span>
              <span className="receipt-value">{order.compradorTelefone || '-'}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Data</span>
              <span className="receipt-value">{data}</span>
            </div>

            {/* Shirts */}
            <div className="receipt-section-title">Itens do Pedido</div>
            {camisas ? camisas.map((s, i) => (
              <div key={i} className="receipt-shirt-item">
                <div className="receipt-shirt-num">Camisa {i + 1}</div>
                <div className="receipt-shirt-detail">
                  {MODEL_LABELS[s.modelo] || s.modelo} · {s.cor}
                </div>
                <div className="receipt-shirt-sub">
                  Tam {s.tamanho} · {s.qtd || 1}x · R$ {((s.qtd || 1) * 25).toFixed(2)}
                </div>
                <div className="receipt-shirt-sub" style={{ marginTop: 4, color: '#f0d0ff', opacity: 1 }}>
                  Estampa: {s.nome || nome} #{s.numero || numero}
                </div>
              </div>
            )) : (
              <div className="receipt-shirt-item">
                <div className="receipt-shirt-num">Camisa 1</div>
                <div className="receipt-shirt-detail">{MODEL_LABELS[modelo] || modelo} · {cor}</div>
                <div className="receipt-shirt-sub">Tamanho {tamanho} · {qtd}x</div>
              </div>
            )}

            {/* Payment */}
            <div className="receipt-section-title">Pagamento</div>
            <div className="receipt-row">
              <span className="receipt-label">Modalidade</span>
              <span className="receipt-value">{pagamento === '2x' ? 'Parcelado (2x)' : 'À Vista'}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Valor Pago</span>
              <span className="receipt-value" style={{ color: '#059669' }}>
                R$ {(valorPago || 0).toFixed(2)}
              </span>
            </div>
            {(saldo || 0) > 0 && (
              <div className="receipt-row">
                <span className="receipt-label">Saldo Restante</span>
                <span className="receipt-value" style={{ color: '#dc2626' }}>
                  R$ {saldo.toFixed(2)}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="receipt-total-section">
              <div className="receipt-total-label">{totalQtd} Camisa{totalQtd !== 1 ? 's' : ''} · Total</div>
              <div className="receipt-total-value">R$ {(total || 0).toFixed(2)}</div>
              <div className="receipt-total-sub">
                {(saldo || 0) === 0 ? '✓ Pagamento completo' : `Parcela 1/2 paga — Restam R$ ${(saldo || 0).toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* Tear + Footer */}
          <div className="receipt-tear">
            <div className="receipt-tear-line" />
          </div>
          <div className="receipt-footer">
            <div className="receipt-footer-text">
              {codigo}<br />
              Guarde este código para acompanhar<br />
              seu pedido pelo site
            </div>
            <div className="receipt-status-chip">{statusDisplay}</div>
          </div>

        </div>
        {/* end #receipt-card */}

      </div>
    </div>
  );
}
