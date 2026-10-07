/**
 * Standalone, ultra-lightweight maintenance shell.
 * Uses 0 external fonts, 0 images from CDN, 0 videos, 0 large assets.
 * Styled with native system fonts and CSS gradients.
 */
export function renderMaintenance(container: HTMLElement = document.getElementById('root') || document.body): void {
  document.title = 'DAITIGN — Maintenance';

  const html = `
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
    background-color: #080808;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  .daitign-maint-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    box-sizing: border-box;
    padding: 32px 20px;
    background: radial-gradient(ellipse at 50% 10%, rgba(229, 9, 20, 0.15) 0%, rgba(8, 8, 8, 0.98) 70%);
  }
  .daitign-maint-card {
    max-width: 520px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    padding: 48px 32px;
    background: rgba(18, 18, 18, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85), 0 0 40px rgba(229, 9, 20, 0.08);
  }
  .daitign-maint-brand {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: #E50914;
    text-transform: uppercase;
    margin-bottom: 24px;
    text-shadow: 0 0 24px rgba(229, 9, 20, 0.4);
  }
  .daitign-maint-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    border-radius: 9999px;
    background: rgba(229, 9, 20, 0.1);
    border: 1px solid rgba(229, 9, 20, 0.3);
    color: #ff6b6b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .daitign-maint-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #E50914;
    box-shadow: 0 0 8px #E50914;
    animation: daitignPulse 2s ease infinite;
  }
  @keyframes daitignPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }
  .daitign-maint-title {
    font-size: clamp(22px, 4.5vw, 30px);
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 16px;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  .daitign-maint-desc {
    font-size: clamp(14px, 2.2vw, 15px);
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 32px;
  }
  .daitign-maint-resume {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 32px;
  }
  .daitign-maint-resume-lbl {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }
  .daitign-maint-resume-val {
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  .daitign-maint-support {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .daitign-maint-support-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.65);
    margin: 0;
  }
  .daitign-maint-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background-color: #E50914;
    color: #ffffff;
    padding: 13px 26px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: all 160ms ease;
    box-shadow: 0 4px 20px rgba(229, 9, 20, 0.35);
  }
  .daitign-maint-btn:hover {
    background-color: #f40612;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(229, 9, 20, 0.55);
  }
  .daitign-maint-handle {
    font-size: 13px;
    opacity: 0.85;
    font-weight: 500;
  }
</style>
<div class="daitign-maint-wrap" id="daitign-maintenance-shell">
  <div class="daitign-maint-card">
    <div class="daitign-maint-brand">DAITIGN</div>
    <div class="daitign-maint-badge">
      <span class="daitign-maint-dot"></span>
      <span>CAPACITY EXPANSION</span>
    </div>
    <h1 class="daitign-maint-title">Streaming Is Temporarily Paused</h1>
    <p class="daitign-maint-desc">
      We've experienced an unusually high number of viewers and daily requests.<br />
      We're expanding capacity so DAITIGN Stream can return more reliably.
    </p>
    <div class="daitign-maint-resume">
      <span class="daitign-maint-resume-lbl">Back Live</span>
      <span class="daitign-maint-resume-val">October 15, 2026</span>
    </div>
    <div class="daitign-maint-support">
      <p class="daitign-maint-support-title">Help Support the Upgrade</p>
      <a
        class="daitign-maint-btn"
        href="https://t.me/stxngn"
        rel="noopener noreferrer"
        target="_blank"
      >
        <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
          <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-1.92 9.06c-.14.65-.53.81-1.07.51l-2.96-2.18-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.03 5.52-4.99c.24-.21-.05-.33-.37-.12l-6.82 4.29-2.94-.92c-.64-.2-.65-.64.13-.95l11.49-4.43c.53-.2 1 .12.76 1.09z"/>
        </svg>
        <span>Contact on Telegram</span>
        <span class="daitign-maint-handle">@stxngn</span>
      </a>
    </div>
  </div>
</div>
`;

  container.innerHTML = html;
}
