import React from 'react';
import { X } from 'lucide-react';

export default function HowItWorksPopup({ onClose }) {
  const mascotSrc = import.meta.env.BASE_URL + 'napolao.png';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, animation: 'fadeIn 0.25s ease-out'
    }}>
      <div style={{
        background: 'var(--cinza)', borderRadius: 24, padding: 0,
        width: '100%', maxWidth: 440, position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)', overflow: 'hidden',
        border: '1px solid var(--cinza3)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Close Button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, 
          background: 'rgba(255,255,255,0.1)', border: 'none', 
          width: 32, height: 32, borderRadius: 16, display: 'flex', 
          alignItems: 'center', justifyContent: 'center', color: '#fff', 
          cursor: 'pointer', zIndex: 10
        }}>
          <X size={18} />
        </button>

        {/* Header / Mascot Area */}
        <div style={{
          background: 'linear-gradient(135deg, var(--roxo), var(--roxo-black))',
          padding: '30px 20px 20px', textAlign: 'center',
          position: 'relative'
        }}>
          {/* Mascot Image */}
          <div style={{
            width: 100, height: 100, margin: '0 auto 12px',
            background: 'var(--roxo-light)', borderRadius: '50%',
            border: '4px solid #fff', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'float 3s ease-in-out infinite'
          }}>
            <img 
              src={mascotSrc} 
              alt="Mascote Napolão" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          
          <h2 style={{ fontFamily: 'var(--fonte-display)', fontSize: 28, color: '#fff', marginBottom: 4 }}>
            E AÍ, GALERA!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Sou eu, o Napolão! Como funciona pra garantir o manto?
          </p>
        </div>

        {/* Steps */}
        <div style={{ padding: '24px 20px', maxHeight: '50vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--dourado-light)', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
            <div>
              <strong style={{ color: '#fff', display: 'block', fontSize: 15, marginBottom: 4 }}>Preencha seus Dados</strong>
              <p style={{ color: 'var(--texto2)', fontSize: 13, lineHeight: 1.4 }}>Vou precisar do seu Nome, E-mail e Zap, pra te mandar o recibo depois.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--roxo-light)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
            <div>
              <strong style={{ color: '#fff', display: 'block', fontSize: 15, marginBottom: 4 }}>Monte a Camisa</strong>
              <p style={{ color: 'var(--texto2)', fontSize: 13, lineHeight: 1.4 }}>Escolha o modelo, coloque seu nome nas costas, o número e o seu tamanho! Você pode adicionar outra diferente, ou clicar em <strong>"Duplicar"</strong> se quiser usar os mesmos dados da camisa anterior para comprar cópias para os amigos ou família!</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--sucesso)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
            <div>
              <strong style={{ color: '#fff', display: 'block', fontSize: 15, marginBottom: 4 }}>Pague & Anexe o Comprovante</strong>
              <p style={{ color: 'var(--texto2)', fontSize: 13, lineHeight: 1.4 }}>Faça o PIX (dá pra pagar a vista ou a metade agora) e NÃO ESQUEÇA de anexar o print do comprovante ali mesmo na tela.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--cinza4)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
            <div>
              <strong style={{ color: '#fff', display: 'block', fontSize: 15, marginBottom: 4 }}>Guarde seu Código!</strong>
              <p style={{ color: 'var(--texto2)', fontSize: 13, lineHeight: 1.4 }}>No final, eu te dou um código secreto. Guarde ele muito bem pra poder acompanhar se o seu manto tá liberado!</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', background: 'var(--cinza2)', borderTop: '1px solid var(--cinza3)' }}>
          <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            Entendi, vou pedir agora! ✨
          </button>
        </div>
      </div>
    </div>
  );
}
