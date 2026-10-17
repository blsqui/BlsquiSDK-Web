<script lang="ts">
  import { onMount } from 'svelte';
  import { BlsquiSDK, type SlotItem } from '@blsqui/sdk-web';

  let currentAddress = $state('');
  let userName = $state('');
  let avatarImage = $state('');
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

    // 2. Central SDK subscription (Auth, Real-time Slot Sync, Profile & IFrame lifecycle)
    const unsubscribeUser = BlsquiSDK.currentUser.subscribe((user: any) => {
      isDashboardOpen = user.dashboardOpen;

      if (user.loggedIn && user.addr) {
        currentAddress = user.addr;
        slotItems = user.slot || [];
        userName = user.userName;
        avatarImage = user.avatarImage;
      } else {
        currentAddress = '';
        userName = '';
        avatarImage = '';
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

  function handleConnectDashboard() {
    BlsquiSDK.summonDashboard();
  }
</script>

<div class="viewport">
  <img src="/game_background.jpeg" alt="Arena" class="bg-layer" />

  <!-- Player Frame HUD -->
  <header class="hud-top-left">
    {#if isDashboardOpen}
      <div class="player-unit-frame">
        <!-- Diamond Portrait Container -->
        <div class="portrait-diamond">
          <div class="portrait-diamond-inner">
            <img 
              src={avatarImage || '/default_avatar.png'} 
              alt={userName || '-'} 
              class="portrait-img" 
            />
          </div>
        </div>

        <!-- Right Side: Vitals Bars & Name -->
        <div class="vitals-block">
          <div class="player-name-row">
            <span class="player-name">{userName || ''}</span>
          </div>
        </div>
      </div>

      <!-- Buffs & Status Pills Row -->
      <div class="hud-sub-row">
        <!-- FLOW Address Badge -->
        <span class="wallet-badge font-mono">
          FLOW: {currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}
        </span>

        <!-- WebRTC Live Status -->
        <span class="status-indicator" class:online={isDashboardOpen}>
          <span class="dot">●</span> {isDashboardOpen ? 'Live Peer' : 'Connecting...'}
        </span>
      </div>
    {/if}

    <!-- Action Button -->
    <button class="connect-btn" onclick={handleConnectDashboard}>
      <span>{isDashboardOpen ? 'Close Dashboard' : 'Open Dashboard'}</span>
    </button>
  </header>

  <!-- In-Game Stage Deck Overlay: Styled identically to the Patron Dashboard -->
  {#if isDashboardOpen && equippedCount > 0}
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
    top: 1.0rem;
    left: 1.6rem;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    user-select: none;
  }

  /* --- Unit Frame Layout --- */
  .player-unit-frame {
    position: relative;
    display: flex;
    align-items: flex-start;
    min-width: 320px;
    height: 94px;
    padding-left: 12px;
  }

  /* --- Diamond Portrait Frame --- */
  .portrait-diamond {
    position: absolute;
    left: 8px;
    top: 4px;
    z-index: 10;
    width: 82px;
    height: 82px;
    transform: rotate(45deg);
    background: #0d121c;
    border: 3px solid #333d4e;
    box-shadow: 
      0 0 0 1px #000,
      0 8px 18px rgba(0, 0, 0, 0.85);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait-diamond-inner {
    width: 114px;
    height: 114px;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  /* --- Vitals / Bars Container --- */
  .vitals-block {
    margin-left: 60px;
    flex: 1;
    display: flex;
    flex-direction: column;
    background: linear-gradient(90deg, rgba(16, 21, 32, 0.95) 0%, rgba(13, 17, 24, 0.85) 85%, transparent 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(0, 0, 0, 0.8);
    padding-left: 22px;
    border-radius: 0 4px 4px 0;
  }

  .player-name-row {
    margin-bottom: 4px;
  }

  .player-name {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: #f1f5f9;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6);
  }

  /* --- Buffs & Status Pills Row --- */
  .hud-sub-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 1rem;
    margin-left: 8px;
  }

  /* FLOW Address Badge */
  .wallet-badge {
    font-size: 11px;
    font-weight: 700;
    color: #4ade80;
    background: rgba(10, 35, 26, 0.85);
    border: 1px solid rgba(34, 197, 94, 0.4);
    padding: 3px 10px;
    border-radius: 9999px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  /* Live Peer Indicator */
  .status-indicator {
    font-size: 11px;
    font-weight: 700;
    color: #f87171;
    background: rgba(38, 18, 20, 0.85);
    border: 1px solid rgba(239, 68, 68, 0.4);
    padding: 3px 10px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  .status-indicator.online {
    color: #34d399;
    background: rgba(10, 35, 26, 0.85);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .status-indicator .dot {
    font-size: 9px;
    line-height: 1;
  }

  /* Patron Dashboard Open Button */
  .connect-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: fit-content;
    padding: 7px 16px;
    margin-left: 8px;
    margin-top: 70px;
    background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 8px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 0.1s ease, filter 0.15s ease;
  }

  .connect-btn:hover {
    filter: brightness(1.1);
  }

  .connect-btn:active {
    transform: scale(0.97);
  }

  .btn-icon {
    font-size: 12px;
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
    border-radius: 7px;
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