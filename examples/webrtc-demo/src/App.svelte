<script lang="ts">
  import { onMount } from 'svelte';
  import { BlsquiSDK, type SlotItem } from '@blsqui/sdk-web';

  let currentAddress = $state('');
  let isDashboardOpen = $state(false);
  let slotItems = $state<SlotItem[]>([]);
  let maxDeckSlots = $derived(slotItems.length);
  let equippedCount = $derived(slotItems.filter((s) => Boolean(s.itemId)).length);

  onMount(() => {
    // 1. Configure Game Credentials
    BlsquiSDK.config({
      publisherId: 'BLSQUI_STUDIO',
      appId: 'valkyrie-vanguard',
      network: 'testnet'
    });

    // 2. Central SDK subscription (Auth, Real-time Slot Sync, and IFrame lifecycle)
    const unsubscribeUser = BlsquiSDK.currentUser.subscribe((user: any) => {
      isDashboardOpen = user.dashboardOpen;

      if (user.loggedIn && user.addr) {
        currentAddress = user.addr;
        slotItems = user.slot || [];
      } else {
        currentAddress = '';
        slotItems = [];
      }

      if (!user.dashboardOpen) {
        console.log('[SDK] Dashboard iframe closed');
      }
    });

    return () => {
      unsubscribeUser();
    };
  });

  // Toggles the Patron Dashboard iframe docked to the right half of the screen
  function handleConnectDashboard() {
    BlsquiSDK.summonDashboard();
  }
</script>

<div class="viewport">
  <img src="/game_background.jpeg" alt="Arena" class="bg-layer" />

  <!-- Top-Left Floating Controls: Moved to left to leave right screen clear -->
  <header class="hud-top-left">
    <div class="hud-row">
      {#if currentAddress}
        <span class="wallet-badge font-mono">FLOW: {currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}</span>
        <span class="status-indicator" class:online={isDashboardOpen}>
          ● {isDashboardOpen ? 'Live Peer' : 'Connecting...'}
        </span>
      {/if}
    </div>

    <!-- Connect / Open Dashboard Button positioned on the left -->
    <button class="connect-btn" onclick={handleConnectDashboard}>
      ⚡ {currentAddress ? 'Open Patron Dashboard' : 'Connect Patron Dashboard'}
    </button>
  </header>

  <!-- In-Game Stage Deck Overlay: Styled identically to the Patron Dashboard -->
  {#if currentAddress && equippedCount > 0}
    <div class="deck-hud-panel">
      <div class="deck-header">
        <div class="deck-title-group">
          <span class="deck-title">ステージスロット装填状態</span>
        </div>
        <!-- Accurately displays 2 / 5 装填中 -->
        <span class="deck-count font-mono">{equippedCount} / {maxDeckSlots} 装填中</span>
      </div>

      <div class="slots-grid">
        {#each Array(maxDeckSlots) as _, idx}
          {@const item = slotItems.find(s => s.slotIndex === idx + 1 && Boolean(s.itemId))}
          
          {#if item}
            <!-- Filled Active Slot -->
            <div class="slot-card filled">
              <div class="card-top">
                <span class="slot-label font-mono"><span class="dot">●</span> SLOT {idx + 1}</span>
                <span class="badge-first">#1 FIRST</span>
              </div>
              <div class="item-visual">
                <img src={item.icon || '/placeholder.png'} alt={item.itemName} class="card-icon" />
              </div>
              <div class="card-bottom">
                <span class="card-item-name truncate">{item.itemName || 'Equipped Item'}</span>
                <div class="durability-row font-mono">
                  <span>{item.remainingCharges ?? 3} / {item.maxCharges ?? 3} Durability</span>
                  <span>
                    ({item.maxCharges ? Math.round(((item.remainingCharges ?? 0) / item.maxCharges) * 100) : 100}%)
                  </span>
                </div>
                <div class="progress-bar-bg">
                  <div 
                    class="progress-bar-fill" 
                    style="width: {item.maxCharges ? ((item.remainingCharges ?? 0) / item.maxCharges) * 100 : 100}%;"
                  ></div>
                </div>
              </div>
            </div>
          {:else}
            <!-- Empty Slot Placeholder -->
            <div class="slot-card empty">
              <div class="card-top">
                <span class="slot-label font-mono">SLOT {idx + 1}</span>
                <span class="empty-tag font-mono">EMPTY</span>
              </div>
              <div class="empty-content">
                <span class="plus-icon">+</span>
                <span class="empty-text">空きスロット</span>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #06080e;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", Meiryo, sans-serif;
    color: #fff;
    user-select: none;
  }

  .viewport {
    position: relative;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .bg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: left top;
    z-index: 1;
    filter: brightness(0.85) contrast(1.05);
  }

  .hud-top-left {
    position: absolute;
    top: 9rem;
    left: 1.25rem;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .hud-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .wallet-badge {
    font-size: 11px;
    color: #00ef8b;
    background: rgba(0, 239, 139, 0.1);
    border: 1px solid rgba(0, 239, 139, 0.3);
    padding: 4px 10px;
    border-radius: 9999px;
    backdrop-filter: blur(8px);
  }

  .status-indicator {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    border-radius: 9999px;
  }

  .status-indicator.online {
    color: #00ef8b;
    border-color: rgba(0, 239, 139, 0.4);
    background: rgba(0, 239, 139, 0.15);
  }

  .connect-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(6, 182, 212, 0.35);
    backdrop-filter: blur(8px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .connect-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 22px rgba(6, 182, 212, 0.55);
  }

  /* --- Patron Dashboard Style Item Slots (Bottom-Left) --- */
  .deck-hud-panel {
    position: absolute;
    bottom: 0;
    left: 1.5rem;
    z-index: 60;
    width: min(300px, calc(100vw - 3rem));
    background: rgba(11, 18, 27, 0.88);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  }

  .deck-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .deck-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .deck-title {
    font-size: 13px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: 0.02em;
  }

  .deck-count {
    font-size: 11px;
    color: #38bdf8;
  }

  .slots-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 10px;
    max-height: 260px;
    overflow-y: auto;
  }

  /* Filled Card Styles */
  .slot-card {
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    min-height: 120px;
  }

  .slot-card.filled {
    background: radial-gradient(circle at top, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(56, 189, 248, 0.35);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .slot-label {
    font-size: 10px;
    font-weight: 700;
    color: #38bdf8;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dot {
    font-size: 8px;
  }

  .badge-first {
    font-family: ui-monospace, monospace;
    font-size: 9px;
    font-weight: 800;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .item-visual {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
  }

  .card-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
  }

  .card-bottom {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-item-name {
    font-size: 11px;
    font-weight: 700;
    color: #f1f5f9;
    text-align: center;
  }

  .durability-row {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;
  }

  .progress-bar-bg {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    border-radius: 9999px;
  }

  /* Empty Card Styles */
  .slot-card.empty {
    background: rgba(15, 23, 42, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.14);
  }

  .empty-tag {
    font-size: 9px;
    color: #64748b;
  }

  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    gap: 4px;
  }

  .plus-icon {
    font-size: 18px;
    color: #475569;
    line-height: 1;
  }

  .empty-text {
    font-size: 10px;
    color: #64748b;
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>