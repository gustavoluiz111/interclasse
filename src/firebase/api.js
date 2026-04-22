import { ref, push, get, update, remove, set } from "firebase/database";
import emailjs from "@emailjs/browser";
import { db } from "./config";

// ─── Helper ────────────────────────────────────────────────────────────────────
const ordersRef = () => ref(db, 'orders');

// ─── Config EmailJS (Chaves de Produção) ───────────────────────────────────────
const EMAILJS_SERVICE  = 'service_zytxyok';
const EMAILJS_TEMPLATE = 'template_f4y9fg9';
const EMAILJS_PUBKEY   = 'PFaygIMxnnvHoHrxq';

const sendEmailNotification = (type, order) => {
  if (!order.compradorEmail || !order.compradorEmail.includes('@') || EMAILJS_PUBKEY === 'YOUR_PUBLIC_KEY') return;
  
  let subject = '';
  let statusText = '';

  if (type === 'create') {
    subject = `OBA! Pedido Recebido! #${order.codigo}`;
    statusText = `Recebemos o seu pedido com sucesso! Estamos aguardando a aprovação do pagamento.`;
  } else if (type === 'approved' || type === 'quitado') {
    subject = `AÊÊ! Pagamento Aprovado! #${order.codigo}`;
    statusText = `Seu pagamento foi confirmado com sucesso! O pedido já está liberado para a gráfica.`;
  } else {
    return;
  }

  // Monta resumo das camisas (nome + número de cada uma)
  const camisasResumo = (order.camisas && order.camisas.length > 0)
    ? order.camisas.map((c, i) =>
        `Camisa ${i + 1}: ${c.nome || order.nome || '-'} #${c.numero || order.numero || '-'} | ${c.modelo} ${c.cor} Tam ${c.tamanho} (${c.qtd}x)`
      ).join('\n')
    : `${order.nome || '-'} #${order.numero || '-'} | ${order.modelo || '-'} Tam ${order.tamanho || '-'}`;

  // Enviar os dados isolados para o Template HTML do EmailJS mapear
  emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
    to_email: order.compradorEmail,
    to_name: order.compradorNome,
    subject: subject,
    status_text: statusText,
    codigo: order.codigo,
    jogador: (order.camisas && order.camisas[0]?.nome) || order.nome || '-',
    numero: (order.camisas && order.camisas[0]?.numero) || order.numero || '-',
    modelos: order.modelo,
    tamanhos: order.tamanho,
    qtd: (order.qtd || 0).toString(),
    camisas_resumo: camisasResumo,
    total: (order.total || 0).toFixed(2).replace('.', ','),
    pago: (order.valorPago || 0).toFixed(2).replace('.', ','),
    saldo: ((order.total || 0) - (order.valorPago || 0)).toFixed(2).replace('.', ',')
  }, EMAILJS_PUBKEY)
  .then(() => console.log('Email enviado para:', order.compradorEmail))
  .catch((e) => console.log('Falha no email silenciosa:', e));
};

// ─── Create Order ──────────────────────────────────────────────────────────────
export const createOrder = async (orderData) => {
  const newRef = push(ordersRef());

  const shortId = newRef.key.slice(-4).toUpperCase();
  const codigo  = `IC-2025-${shortId}`;
  const now     = new Date();
  const dataBR  = now.toLocaleDateString('pt-BR');

  const finalData = {
    ...orderData,
    codigo,
    data: dataBR,
    timestamp: now.getTime(),
    status: 'analise',
    historico: [{
      data: dataBR,
      acao: 'Pedido enviado — aguardando aprovação'
    }],
    comprovanteUrl: '',
  };

  await update(newRef, finalData);
  sendEmailNotification('create', finalData);
  return { ...finalData, id: newRef.key };
};

// ─── Fetch All Orders (Admin) ──────────────────────────────────────────────────
export const fetchOrders = async () => {
  const snap = await get(ordersRef());
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

// ─── Fetch Single Order by Codigo ──────────────────────────────────────────────
export const fetchOrderByCodigo = async (codigo) => {
  const snap = await get(ordersRef());
  if (!snap.exists()) return null;
  const data = snap.val();
  const entry = Object.entries(data).find(([, v]) => v.codigo === codigo);
  return entry ? { id: entry[0], ...entry[1] } : null;
};

// ─── Update Status ─────────────────────────────────────────────────────────────
export const updateOrderStatus = async (id, status, acao) => {
  const oRef = ref(db, `orders/${id}`);
  const snap = await get(oRef);
  if (!snap.exists()) return null;

  const order = snap.val();
  let finalStatus = status;
  let textAction = acao;

  if (status === 'aprovado' && order.saldo <= 0) {
    finalStatus = 'quitado';
    textAction = textAction + ' (Pagamento Total Confirmado)';
  }

  const historico = [...(order.historico || []), {
    data: new Date().toLocaleDateString('pt-BR'),
    acao: textAction,
  }];

  await update(oRef, { status: finalStatus, historico });
  if (finalStatus === 'aprovado' || finalStatus === 'quitado') {
    sendEmailNotification('approved', { ...order, status: finalStatus });
  }
};

// ─── Register Payment ──────────────────────────────────────────────────────────
export const updateOrderPayment = async (id, valorPagoAdicional) => {
  const oRef = ref(db, `orders/${id}`);
  const snap = await get(oRef);
  if (!snap.exists()) return null;

  const order       = snap.val();
  const novoValorPago = (order.valorPago || 0) + valorPagoAdicional;
  const novoSaldo     = Math.max(0, (order.total || 0) - novoValorPago);
  const novoStatus    = novoSaldo === 0 ? 'quitado' : 'aprovado';
  const now           = new Date().toLocaleDateString('pt-BR');

  const historico = [...(order.historico || []),
    { data: now, acao: `Pagamento registrado: R$ ${valorPagoAdicional.toFixed(2)}` },
    ...(novoSaldo === 0 ? [{ data: now, acao: 'Pedido quitado — pagamento completo ✓' }] : [])
  ];

  const payload = {
    valorPago: novoValorPago, 
    saldo: novoSaldo, 
    status: novoStatus, 
    historico 
  };
  await update(oRef, payload);
  if (novoStatus === 'aprovado' || novoStatus === 'quitado') {
    sendEmailNotification('approved', { ...order, ...payload });
  }
};

// ─── Update Order Data (Admin Edit) ──────────────────────────────────────────────
export const updateOrderData = async (id, updatedFields) => {
  const oRef = ref(db, `orders/${id}`);
  const snap = await get(oRef);
  if (!snap.exists()) return null;
  const order = snap.val();

  const now = new Date().toLocaleDateString('pt-BR');
  const historico = [...(order.historico || []), {
    data: now,
    acao: 'Pedido editado pelo administrador',
  }];

  await update(oRef, { ...updatedFields, historico });
  return true;
};

// ─── Delete Order (Admin) ──────────────────────────────────────────────
export const deleteOrder = async (id) => {
  const oRef = ref(db, `orders/${id}`);
  await remove(oRef);
  return true;
};

// ─── Delete ALL Orders (Danger - Utility) ──────────────────────────────────────
export const deleteAllOrders = async () => {
  await set(ref(db, 'orders'), null);
  return true;
};

// ─── Upload Comprovante (PDF apenas) ──────────────────────────────────────────
// PDFs de comprovante PIX são sempre pequenos (<300KB) — sem necessidade de compressão
export const uploadComprovante = async (codigo, base64Pdf) => {
  try {
    const snap = await get(ref(db, 'orders'));
    if (snap.exists()) {
      const data = snap.val();
      const entry = Object.entries(data).find(([, v]) => v.codigo === codigo);
      if (entry) {
        await update(ref(db, `orders/${entry[0]}`), {
          comprovanteUrl: base64Pdf,
          comprovanteAnexado: true,
        });
      }
    }
    return base64Pdf;
  } catch (err) {
    console.warn('Falha ao salvar comprovante PDF:', err.message);
    try {
      const snap = await get(ref(db, 'orders'));
      if (snap.exists()) {
        const data = snap.val();
        const entry = Object.entries(data).find(([, v]) => v.codigo === codigo);
        if (entry) {
          await update(ref(db, `orders/${entry[0]}`), { comprovanteAnexado: false });
        }
      }
    } catch (_) {}
    return null;
  }
};
