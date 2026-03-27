export function gerarPixPayload(chave, valor, nome) {
  const campo = (id, val) => String(id).padStart(2, '0') + String(val.length).padStart(2, '0') + val;
  const mai = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave);
  
  // Format valor to precisely 2 decimal places string
  const formattedValor = parseFloat(valor).toFixed(2);
  const safeName = (nome || 'PAGADOR').substring(0, 25).trim();

  const payload = 
    campo('00', '01') +
    campo('26', mai) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', formattedValor) +
    campo('58', 'BR') +
    campo('59', safeName) +
    campo('60', 'Recife') +
    campo('62', campo('05', '***'));
    
  return payload + '6304' + calcCRC16(payload + '6304');
}

function calcCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}
