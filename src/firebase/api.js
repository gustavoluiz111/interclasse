import { ref, push, get, update, remove, set } from "firebase/database";
import emailjs from "@emailjs/browser";
import { db } from "./config";

// ─── Helper ────────────────────────────────────────────────────────────────────
const ordersRef = () => ref(db, 'orders');

// ─── Config EmailJS (Chaves Provisórias) ───────────────────────────────────────
const EMAILJS_SERVICE = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBKEY = 'YOUR_PUBLIC_KEY';

const sendEmailNotification = (type, order) => {
  if (!order.compradorEmail || !order.compradorEmail.includes('@') || EMAILJS_PUBKEY === 'YOUR_PUBLIC_KEY') return;
  
  let subject = '';
  let statusText = '';
  let emojis = '';

  if (type === 'create') {
    subject = `OBA! Pedido Recebido! #${order.codigo}`;
    statusText = `Recebemos o seu pedido #${order.codigo} com sucesso! Estamos apenas aguardando a aprovação do seu pagamento na plataforma. Se você já pagou e enviou o comprovante, logo enviaremos a confirmação.`;
    emojis = '⏳💳';
  } else if (type === 'approved' || type === 'quitado') {
    subject = `AÊÊ! Pagamento Aprovado! #${order.codigo}`;
    statusText = `Seu pagamento foi confirmado com SUCESSO! O pedido #${order.codigo} já está liberado e vai rodar bonito para a gráfica em breve!`;
    emojis = '🎉🔥';
  } else {
    return;
  }

  const message = `${emojis} ${statusText}

--------------------------------------------------
🛍️ DETALHES DO SEU PEDIDO
--------------------------------------------------
Código: ${order.codigo}
Titular (Atrás da Camisa): ${order.nome}
Número Escolhido: ${order.numero}
Cor / Modelo: ${order.modelo}
Tamanhos: ${order.tamanho}
Qtd Final: ${order.qtd} un.

💰 Total Pedido: R$ ${order.total.toFixed(2).replace('.', ',')}
💸 Valor Pago: R$ ${order.valorPago.toFixed(2).replace('.', ',')}
💳 Faltando: R$ ${(order.total - order.valorPago).toFixed(2).replace('.', ',')}
--------------------------------------------------

Muito obrigado por vestir nossa camisa escolar! Qualquer dúvida, chame a coordenação das turmas.

--------------------------------------------------
💜 Feito com tecnologia de ponta para a Interclasse.
💻 DEV: Luiz Gustavo
📸 Siga a gente no Instagram: @napo.litanoofc | @lg_wstudio
--------------------------------------------------
  `;

  emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
    to_email: order.compradorEmail,
    to_name: order.compradorNome,
    subject: subject,
    message: message
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
    status: orderData.valorPago >= orderData.total ? 'quitado' : 'analise',
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

  const order    = snap.val();
  const historico = [...(order.historico || []), {
    data: new Date().toLocaleDateString('pt-BR'),
    acao,
  }];

  await update(oRef, { status, historico });
  if (status === 'aprovado' || status === 'quitado') {
    sendEmailNotification('approved', { ...order, status });
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

// ─── Delete Order (Admin) ──────────────────────────────────────────────────────
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

// ─── Upload Comprovante ────────────────────────────────────────────────────────
// Salva a imagem como base64 comprimida diretamente no RTDB (sem Firebase Storage)
export const uploadComprovante = async (codigo, base64Image) => {
  try {
    // Comprime a imagem para max ~400px e qualidade 70% para reduzir tamanho
    const compressed = await compressImage(base64Image, 400, 0.7);

    const snap = await get(ref(db, 'orders'));
    if (snap.exists()) {
      const data = snap.val();
      const entry = Object.entries(data).find(([, v]) => v.codigo === codigo);
      if (entry) {
        await update(ref(db, `orders/${entry[0]}`), {
          comprovanteUrl: compressed,
          comprovanteAnexado: true,
        });
      }
    }
    return compressed;
  } catch (err) {
    console.warn('Falha ao salvar comprovante:', err.message);
    // Mesmo com erro, marca que houve tentativa
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

// ─── Compress Image (browser canvas) ──────────────────────────────────────────
const compressImage = (base64, maxSize = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    // Se não for imagem (ex: PDF), retorna string vazia
    if (!base64.startsWith('data:image')) {
      resolve('pdf://comprovante-pdf');
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      // Reduz proporcionalmente
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width  = maxSize;
        } else {
          width  = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64); // fallback sem compressão
    img.src = base64;
  });
};
