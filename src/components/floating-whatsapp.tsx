export default function FloatingWhatsApp() {
  const waStyles = `
    #wa-float-btn {
      position: fixed;
      bottom: 70px;
      right: 16px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    #wa-float-btn .wa-tooltip {
      background: #075E54;
      color: #fff;
      font-size: 13px;
      font-family: sans-serif;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 20px;
      white-space: nowrap;
      opacity: 0;
      transform: translateX(10px);
      transition: opacity 0.4s ease, transform 0.4s ease;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    #wa-float-btn .wa-tooltip.show {
      opacity: 1;
      transform: translateX(0px);
    }
    #wa-float-btn:hover .wa-tooltip {
      opacity: 1;
      transform: translateX(0px);
    }
    #wa-float-btn .wa-circle {
      position: relative;
      width: 56px;
      height: 56px;
      flex-shrink: 0;
    }
    #wa-float-btn .wa-pulse {
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: rgba(37,211,102,0.3);
      animation: waPulse 2s ease-out infinite;
      pointer-events: none;
    }
    #wa-float-btn .wa-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #25D366;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(37,211,102,0.5);
      position: relative;
      z-index: 1;
    }
    #wa-float-btn .wa-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ff3b30;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
      font-weight: 700;
      opacity: 0;
      transition: opacity 0.3s;
    }
    @keyframes waPulse {
      0%   { transform: scale(1);    opacity: 0.6; }
      70%  { transform: scale(1.55); opacity: 0;   }
      100% { transform: scale(1.55); opacity: 0;   }
    }
  `;

  const waScript = `
    (function() {
      function playChime() {
        try {
          var ctx = new (window.AudioContext || window.webkitAudioContext)();
          [523.25, 659.25, 783.99].forEach(function(freq, i) {
            var osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq; osc.type = 'sine';
            var t = ctx.currentTime + i * 0.18;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.start(t); osc.stop(t + 0.4);
          });
        } catch(e) {}
      }

      function notify() {
        playChime();

        var badge = document.getElementById('waBadge');
        var tooltip = document.querySelector('#wa-float-btn .wa-tooltip');

        if (badge) { badge.style.opacity = '1'; }
        if (tooltip) { tooltip.classList.add('show'); }

        setTimeout(function() {
          if (badge) { badge.style.opacity = '0'; }
          if (tooltip) { tooltip.classList.remove('show'); }
        }, 5000);
      }

      setInterval(notify, 3 * 60 * 1000);
    })();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: waStyles }} />

      <div id="wa-float-btn">
        <span className="wa-tooltip">Join our WhatsApp Group!</span>
        <div className="wa-circle">
          <div className="wa-pulse"></div>
          <a
            className="wa-link"
            href="https://chat.whatsapp.com/GkT03AzB3cxKJQrLLfj9S8"
            target="_blank"
            rel="noopener"
            aria-label="Join our WhatsApp group"
          >
            <svg width="30" height="30" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C8.28 2 2 8.28 2 16c0 2.46.66 4.76 1.8 6.76L2 30l7.44-1.76A13.9 13.9 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.42 11.42 0 0 1-5.84-1.6l-.42-.26-4.42 1.04 1.06-4.3-.28-.44A11.46 11.46 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.28-8.56c-.34-.18-2-.98-2.32-1.1-.3-.1-.52-.16-.74.18-.22.34-.86 1.1-1.06 1.32-.2.22-.38.24-.72.06-.34-.18-1.44-.52-2.74-1.66-1.02-.9-1.7-2-1.9-2.34-.2-.34-.02-.52.14-.7.16-.14.34-.38.52-.56.18-.2.24-.34.34-.56.1-.22.06-.42-.02-.6-.08-.18-.74-1.76-1-2.4-.26-.62-.52-.54-.74-.54h-.62c-.22 0-.58.08-.88.42-.3.32-1.16 1.12-1.16 2.74s1.18 3.18 1.34 3.4c.18.22 2.32 3.56 5.62 4.98.78.34 1.4.54 1.88.68.78.24 1.5.2 2.06.12.62-.1 1.98-.8 2.26-1.58.28-.76.28-1.42.2-1.56-.1-.14-.3-.22-.64-.4z" />
            </svg>
          </a>
          <div className="wa-badge" id="waBadge">1</div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: waScript }} />
    </>
  );
}