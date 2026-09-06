<script lang="ts">
  import { onMount } from 'svelte';
  import { BlsquiSDK } from '@blsqui/sdk-web';

  let carXPercent = $state(80); // Start 30% right of center
  let isMovingLeft = $state(false);
  let isMovingRight = $state(false);
  let isTransactionActive = $state(false);
  let isEntryCompleted = $state(false);
  let autoDriveExit = $state(false);
  let statusMessage = $state('Explore the garage with < and >');

  const MOVE_SPEED = 0.6;
  const TRIGGER_THRESHOLD = 30;
  // Svelte 5 Runes: reactive state declaration
  let sealedReceipt = $state<{
    txId?: string;
    payer?: string;
    to?: string;
    amount?: string;
    token?: string;
    nonce?: string;
  } | null>(null);

  /**
   * トランザクション制御処理
   */
  async function checkTrigger() {
    // 処理の多重実行防止
    if (isEntryCompleted || autoDriveExit || isTransactionActive) return;

    if (carXPercent <= TRIGGER_THRESHOLD) {
      isTransactionActive = true;
      statusMessage = 'Tournament check-in requested...';

      // Blsqui SDK を呼び出し (SDK内部でポーリングしてトランザクション結果が返されます)
      const result = await BlsquiSDK.requestTransaction({
        useDefaultModal: true,                                                      // 組み込みの確認モーダルUIを使用
        isTestnet: true,                                                            // Flow Testnet を指定
        verbose: true,                                                              // 開発用コンソールログを有効化
        flixId: '6aae990ef2619581c28acbc4ac09594d4e9c3e0829bd5533eed88214ea6b3c3d', // 実行対象の FLIX ID
        args: {                                                                     // FLIX 実行に必要な引数
          to: '0xa090f900023d6d34'
        }
      });

      isTransactionActive = false;

      // 判定処理例
      if (result.status === 'SEALED') {
        console.log(result);
        isEntryCompleted = true;
        
        // SDKから取得した確定データをHUD表示用に格納
        sealedReceipt = {
          txId: result.txId,
          payer: result.payer,
          to: result.to,
          amount: result.amount,
          token: result.token,
          nonce: result.nonce
        };

        statusMessage = `🎉 Entry sealed! TX: ${result.txId?.slice(0, 8)}...`;
        autoDriveExit = true;
      }
      else if (result.status === 'CANCELED') {
        statusMessage = 'Tournament entry canceled.';
        carXPercent = Math.min(90, carXPercent + 4.5);
      } 
      else {
        statusMessage = `Transaction ${result.status.toLowerCase()}: ${result.error || result.errorMessage || ''}`;
        carXPercent = Math.min(90, carXPercent + 4.5);
      }
    }
  }

  function moveLeft() {
    if (isTransactionActive || autoDriveExit) return;
    carXPercent = Math.max(10, carXPercent - MOVE_SPEED);
    checkTrigger();
  }

  function moveRight() {
    if (isTransactionActive || autoDriveExit) return;
    carXPercent = Math.min(90, carXPercent + MOVE_SPEED);
  }

  onMount(() => {
    let frameId: number;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') isMovingLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') isMovingRight = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') isMovingLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') isMovingRight = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const loop = () => {
      if (autoDriveExit) {
        carXPercent -= 1.2;
        if (carXPercent < -25) {
          statusMessage = '🏁 Entering Tournament Arena!';
        }
      } else if (!isTransactionActive) {
        if (isMovingLeft) moveLeft();
        if (isMovingRight) moveRight();
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(frameId);
    };
  });
</script>

<div class="viewport">
  <img src="/garage_background.jpg" alt="Garage" class="bg-layer" />

  <header class="hud-top">
    <div class="hud-row">
      <span class="hud-badge">Blsqui Web SDK Demo</span>
      <span class="hud-status">{statusMessage}</span>
    </div>

    {#if sealedReceipt}
      <div class="receipt-card">
        <div class="receipt-header">
          <span class="receipt-title">⚡ On-Chain Transaction Receipt / トランザクション結果</span>
          <span class="receipt-pill">SEALED</span>
        </div>
        <div class="receipt-grid">
          <div class="receipt-item">
            <span class="label">Authorizer / 署名者</span>
            <span class="value font-mono">0x{sealedReceipt.payer}</span>
          </div>
          <div class="receipt-item">
            <span class="label">To (Recipient / 受取人)</span>
            <span class="value font-mono">{sealedReceipt.to}</span>
          </div>
          <div class="receipt-item">
            <span class="label">Amount Paid / 支払額(トークン種別)</span>
            <span class="value font-mono">{sealedReceipt.amount} {sealedReceipt.token}</span>
          </div>
          <div class="receipt-item">
            <span class="label">Transaction Reference ID</span>
            <span class="value font-mono truncate" title={sealedReceipt.nonce}>{sealedReceipt.nonce?.slice(0, 20)}...</span>
          </div>
          <div class="receipt-item full-width">
            <span class="label">Transaction Hash</span>
            <a
              href={`https://testnet.flowscan.io/tx/${sealedReceipt.txId}`} 
              target="_blank" 
              rel="noreferrer" 
              class="value link font-mono"
            >
              {sealedReceipt.txId} ↗
            </a>
          </div>
        </div>
      </div>
    {/if}
  </header>

  <div class="car-track" style="left: {carXPercent}%;">
    <img 
      src="/cyber_car.png" 
      alt="Cyber Car" 
      class="cyber-car" 
      class:driving-fast={autoDriveExit} 
    />
  </div>

  <footer class="hud-bottom">
    <div class="controller-cluster">
      <button 
        type="button" 
        class="ctrl-btn" 
        onpointerdown={() => (isMovingLeft = true)}
        onpointerup={() => (isMovingLeft = false)}
        onpointerleave={() => (isMovingLeft = false)}
        disabled={isTransactionActive || autoDriveExit}
      >◀</button>

      <span class="ctrl-hint">STEER CAR</span>

      <button 
        type="button" 
        class="ctrl-btn" 
        onpointerdown={() => (isMovingRight = true)}
        onpointerup={() => (isMovingRight = false)}
        onpointerleave={() => (isMovingRight = false)}
        disabled={isTransactionActive || autoDriveExit}
      >▶</button>
    </div>

    <div class="hud-hint-text">
      Move past 30% from the left to trigger the SDK modal.
    </div>
  </footer>
</div>

<style>
  :global(body) { margin: 0; padding: 0; overflow: hidden; background-color: #06080e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #fff; user-select: none; }
  .viewport { position: relative; width: 100vw; height: 100vh; height: 100dvh; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
  .bg-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center center; z-index: 1; filter: brightness(0.65) contrast(1.05); }
  .hud-badge { font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.08em; color: #38bdf8; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 4px 12px; border-radius: 9999px; backdrop-filter: blur(6px); }
  .hud-status { font-family: ui-monospace, monospace; font-size: 12px; color: #cbd5e1; background: rgba(0, 0, 0, 0.55); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); }
  .car-track { position: absolute; bottom: 22%; transform: translate(-50%, 0); z-index: 2; transition: left 0.04s linear; pointer-events: none; }
  .cyber-car { width: clamp(280px, 35vw, 540px); object-fit: contain; filter: drop-shadow(0 15px 30px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.3)); animation: idle-hover 3s ease-in-out infinite; }
  .driving-fast { animation: none; filter: drop-shadow(-20px 0 25px rgba(6, 182, 212, 0.6)); }
  @keyframes idle-hover { 0%, 100% { transform: translateY(25%); } 50% { transform: translateY(calc(25% - 8px)); } }
  .hud-bottom {
    position: absolute;
    bottom: 1.5rem;
    left: 0;
    right: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: auto; /* Ensures buttons remain clickable */
  }
  .controller-cluster { display: flex; align-items: center; gap: 18px; }
  .ctrl-btn { width: 64px; height: 52px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #e2e8f0; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease; }
  .ctrl-btn:hover:not(:disabled) { background: rgba(51, 65, 85, 0.9); border-color: #38bdf8; color: #38bdf8; transform: translateY(-2px); }
  .ctrl-btn:active:not(:disabled) { transform: translateY(1px); background: #0284c7; color: #fff; }
  .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ctrl-hint { font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.15em; color: #64748b; font-weight: 700; }
  .hud-hint-text { font-size: 12px; color: #94a3b8; font-family: ui-monospace, monospace; }
  .hud-top {
    position: absolute;
    top: 1rem;
    left: 1rem;
    /* Remove right: 1rem */
    width: min(620px, calc(100vw - 2rem));
    max-height: calc(100vh - 120px); /* Leaves space for the footer */
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    pointer-events: none;
  }

  .hud-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .receipt-card {
    pointer-events: auto;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 239, 139, 0.4);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    max-width: 620px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    animation: fadeInSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .receipt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.4rem;
  }

  .receipt-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .receipt-pill {
    font-size: 0.65rem;
    font-weight: 800;
    color: #00ef8b;
    background: rgba(0, 239, 139, 0.12);
    border: 1px solid rgba(0, 239, 139, 0.3);
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
  }

  .receipt-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 1rem;
  }

  .receipt-item {
    display: flex;
    flex-direction: column;
  }

  .receipt-item.full-width {
    grid-column: span 2;
  }

  .receipt-item .label {
    font-size: 0.68rem;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .receipt-item .value {
    font-size: 0.78rem;
    color: #f1f5f9;
  }

  .receipt-item .value.highlight {
    color: #00ef8b;
    font-weight: 700;
  }

  .receipt-item .link {
    color: #38bdf8;
    text-decoration: underline;
    word-break: break-all;
  }

  .receipt-item .link:hover {
    color: #7dd3fc;
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>