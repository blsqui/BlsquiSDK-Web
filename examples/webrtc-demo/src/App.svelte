<script lang="ts">
  import { onMount } from 'svelte';
  import { BlsquiSDK, type SlotItem, type TransactionResult } from '@blsqui/sdk-web';

  const PUBLISHER_ADDRESS = '0x2f13c512df0b0ad7';
  const OPPONENT_ADDRESS = '0x2f13c512df0b0ad7';

  let currentAddress = $state('');
  let userName = $state('');
  let avatarImage = $state('');
  let isLoggedIn = $state(false);
  let isDashboardOpen = $state(false);
  let slotItems = $state<SlotItem[]>([]);
  let maxDeckSlots = $derived(slotItems.length);
  let equippedCount = $derived(slotItems.filter((s) => Boolean(s.itemId)).length);
  let isPurchasingWeapon = $state(false);

  onMount(() => {
    // SDK 初期化設定
    BlsquiSDK.config({
      publisherAddress: OPPONENT_ADDRESS,
      appId: 'valkyrie-vanguard',
      network: 'testnet'
    });

    // SDKセッション購読
    const unsubscribeUser = BlsquiSDK.currentUser.subscribe((user: any) => {
      isDashboardOpen = user.dashboardOpen;
      isLoggedIn = Boolean(user.loggedIn && user.addr);

      if (isLoggedIn) {
        currentAddress = user.addr;
        slotItems = user.slot || [];
        userName = user.userName || '';
        avatarImage = user.avatarImage || '';
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

  async function handleQuickWeaponPurchase() {
    if (isPurchasingWeapon) return;
    try {
      isPurchasingWeapon = true;
      const sealedReceipt: TransactionResult = await BlsquiSDK.requestTransaction({
        isTestnet: true,
        flixId: '1fdc90072ed488b74f407cfa45602efabf865eee7c7d4be6c30247ab56793ee6',
        useDefaultModal: false
      });

      console.log('✅ Weapon purchased successfully:', sealedReceipt);
    } catch (_) {
    } finally {
      isPurchasingWeapon = false;
    }
  }

  const WEAPON_ITEM_ID = 'wpn_dragon_piercer_2';
  const SHIELD_ITEM_ID = 'shd_valkyrie_aegis_2';
  let equippedWeaponSlot = $derived(
    slotItems.find((s) => s.itemId === WEAPON_ITEM_ID)
  );
  let isWeaponEquipped = $derived(Boolean(equippedWeaponSlot));
  let equippedShieldSlot = $derived(
    slotItems.find((s) => s.itemId === SHIELD_ITEM_ID)
  );
  let isShieldEquipped = $derived(Boolean(equippedShieldSlot));

  // Action: Urge using Weapon
  async function handleUseWeapon() {
    if (!isWeaponEquipped) return;
    BlsquiSDK.postMessageToDashboard({
      type: 'TRIGGER_ITEM_ACTION',
      itemId: WEAPON_ITEM_ID
    });
  }

  // Action: Urge using Shield
  async function handleUseShield() {
    if (!isShieldEquipped) return;
    BlsquiSDK.postMessageToDashboard({
      type: 'TRIGGER_ITEM_ACTION',
      itemId: SHIELD_ITEM_ID
    });
  }

  let isScouting = $state(false);
  let showOpponentDeck = $state(false);
  let opponentSlots = $state<SlotItem[]>([]);
  let opponentEquippedCount = $derived(opponentSlots.filter((s) => Boolean(s.itemId)).length);
  let opponentMaxSlots = $derived(Math.max(5, opponentSlots.length));
  async function handleScoutOpponent() {
    if (isScouting) return;
    // Toggle off if already showing
    if (showOpponentDeck) {
      showOpponentDeck = false;
      return;
    }
    try {
      isScouting = true;
      const slots = await BlsquiSDK.getStageSlots({
        targetAddress: OPPONENT_ADDRESS,
        publisherAddress: PUBLISHER_ADDRESS
      });
      console.log(slots, 999)
      opponentSlots = slots;
      showOpponentDeck = true;
    } catch (e) {
      console.error('Failed to scout opponent:', e);
    } finally {
      isScouting = false;
    }
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
        {#if isLoggedIn && currentAddress}
          <!-- FLOW アドレス表示 -->
          <span class="wallet-badge font-mono">
            FLOW: {currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}
          </span>

          <!-- ログイン時の WebRTC / Peer 接続状況 -->
          <span class="status-indicator" class:online={isDashboardOpen}>
            <span class="dot">●</span> {isDashboardOpen ? 'Live Peer' : 'Connecting...'}
          </span>
        {:else}
          <!-- 未サインイン時の表示 -->
          <span class="status-indicator offline">
            <span class="dot">○</span> Guest / Not Signed In
          </span>
        {/if}
      </div>
    {/if}
  </header>
  <div class="hud-controller-container">
    <div class="hud-diamond-grid">
      <!-- Ambient Backdrop Ring -->
      <div class="ambient-ring"></div>

      <!-- TOP: ATK -->
      <button 
        type="button" 
        class="diamond-btn btn-atk" 
        class:disabled={!isWeaponEquipped}
        disabled={!isWeaponEquipped}
        onclick={handleUseWeapon}
        title={isWeaponEquipped ? 'Use Dragon Piercer' : 'Dragon Piercer not equipped'}
      >
        <div class="diamond-content">
          <svg class="hud-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span class="hud-label">ATK</span>
        </div>
      </button>

      <!-- LEFT: SHOP (Quick Weapon Purchase) -->
      <button
        type="button" 
        class="diamond-btn btn-shop" 
        onclick={handleQuickWeaponPurchase}
        disabled={isPurchasingWeapon}
        title={isPurchasingWeapon ? 'Processing Purchase...' : 'Quick Weapons Shop'}
      >
        <div class="diamond-content">
          {#if isPurchasingWeapon}
            <!-- Loading Spinner Icon -->
            <svg class="hud-icon animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span class="hud-label">MINTING</span>
          {:else}
            <!-- Shopping Bag Icon -->
            <svg class="hud-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span class="hud-label">SHOP</span>
          {/if}
        </div>
      </button>

      <!-- CENTER: HUB -->
      <button type="button" class="diamond-btn btn-hub" onclick={handleConnectDashboard} title="Open Dashboard Screen">
        <div class="hub-backdrop"></div>
        <div class="diamond-content">
          <svg class="hud-icon hub-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span class="hud-label hub-label">{isDashboardOpen ? 'CLOSE' : 'HUB'}</span>
        </div>
      </button>

      <!-- RIGHT: DEF -->
      <button 
        type="button"
        class="diamond-btn btn-def" 
        class:disabled={!isShieldEquipped}
        disabled={!isShieldEquipped}
        onclick={handleUseShield}
        title={isShieldEquipped ? 'Activate Valkyrie Aegis' : 'Valkyrie Aegis not equipped'}
      >
        <div class="diamond-content">
          <svg class="hud-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span class="hud-label">DEF</span>
        </div>
      </button>

      <!-- BOTTOM: SCOUT -->
      <button 
        type="button" 
        class="diamond-btn btn-scout" 
        onclick={handleScoutOpponent}
        title={showOpponentDeck ? 'Hide Opponent Slots' : 'Inspect Opponent Slots'}
      >
        <div class="diamond-content">
          {#if isScouting}
            <svg class="hud-icon animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span class="hud-label">SCAN</span>
          {:else}
            <svg class="hud-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span class="hud-label">{showOpponentDeck ? 'CLOSE' : 'SCOUT'}</span>
          {/if}
        </div>
      </button>
    </div>
  </div>

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
  <!-- Opponent's Deck Overlay (Sits directly to the right of Player Deck) -->
  {#if showOpponentDeck}
    <div class="deck-hud-panel opponent-deck-panel">
      <div class="deck-header">
        <div class="deck-title-group">
          <span class="deck-title text-rose-400">ENEMY DECK ({OPPONENT_ADDRESS.slice(0, 6)}...{OPPONENT_ADDRESS.slice(-4)})</span>
        </div>
        <span class="deck-count font-mono text-rose-300">
          {opponentEquippedCount} / {opponentMaxSlots} 検出
        </span>
      </div>

      <div class="slots-grid">
        {#each Array(opponentMaxSlots) as _, idx}
          {@const oppItem = opponentSlots.find(s => s.slotIndex === idx + 1 && Boolean(s.itemId))}
          
          {#if oppItem}
            <div class="slot-card filled border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <div class="card-top">
                <span class="slot-label font-mono text-rose-400"><span class="dot text-rose-500">●</span> SLOT {idx + 1}</span>
                <span class="badge-enemy font-mono">HOSTILE</span>
              </div>
              <div class="item-visual">
                <span class="text-xs font-mono text-rose-300 font-bold px-1 text-center truncate">
                  {oppItem.itemId}
                </span>
              </div>
              <div class="card-bottom">
                <span class="card-item-name text-rose-200 truncate">{oppItem.itemId}</span>
                <div class="durability-row font-mono text-slate-400">
                  <span>ACTIVE ON-CHAIN</span>
                </div>
              </div>
            </div>
          {:else}
            <div class="slot-card empty">
              <div class="card-top">
                <span class="slot-label font-mono">SLOT {idx + 1}</span>
                <span class="empty-tag font-mono">EMPTY</span>
              </div>
              <div class="empty-content">
                <span class="empty-text">未装填</span>
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
    background: white;
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
    margin-top: 2rem;
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
  .hud-controller-container {
    position: absolute;
    left: 1.5rem;
    top: 38%;
    transform: translateY(-38%);
    z-index: 40;
    user-select: none;
  }

  .hud-diamond-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 80px);
    grid-template-rows: repeat(3, 80px);
    width: 240px;
    height: 240px;
    align-items: center;
    justify-items: center;
  }

  /* Ambient backdrop blur ring */
  .ambient-ring {
    position: absolute;
    inset: 16px;
    border-radius: 50%;
    border: 1px solid rgba(6, 182, 212, 0.2);
    background: radial-gradient(circle, rgba(8, 51, 68, 0.3) 0%, transparent 70%);
    filter: blur(4px);
    pointer-events: none;
  }

  /* Base button styling */
  .diamond-btn {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
  }

  .diamond-btn:active {
    transform: scale(0.92);
  }
  /* Disabled / Deactivated State */
  .diamond-btn:disabled,
  .diamond-btn.disabled {
    opacity: 0.25;
    filter: grayscale(1);
    cursor: not-allowed !important;
    pointer-events: none;
    box-shadow: none !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
    background: #121214 !important;
  }

  .diamond-btn:disabled .hud-icon,
  .diamond-btn:disabled .hud-label {
    color: #71717a !important;
  }

  .diamond-btn:disabled:active {
    transform: rotate(45deg) scale(1) !important; /* Prevent click scale bounce */
  }
  /* Diamond rotation and counter-rotation for outer buttons */
  .btn-atk, .btn-shop, .btn-def, .btn-scout {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    transform: rotate(45deg);
    border: 1px solid transparent;
  }

  .diamond-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform: rotate(-45deg);
  }

  .hud-icon {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
    transition: transform 0.2s ease;
  }

  .diamond-btn:hover .hud-icon {
    transform: scale(1.1);
  }

  .hud-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }

  /* 1. TOP: ATK (Row 1, Col 2) */
  .btn-atk {
    grid-column: 2;
    grid-row: 1;
    background: linear-gradient(135deg, rgba(217, 119, 6, 0.35) 0%, #18181b 100%);
    border-color: rgba(245, 158, 11, 0.45);
  }
  .btn-atk:hover {
    border-color: #f59e0b;
    box-shadow: 0 0 22px rgba(245, 158, 11, 0.55);
  }
  .btn-atk .hud-icon, .btn-atk .hud-label {
    color: #fbbf24;
  }

  /* 2. LEFT: SHOP (Row 2, Col 1) */
  .btn-shop {
    grid-column: 1;
    grid-row: 2;
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.35) 0%, #18181b 100%);
    border-color: rgba(168, 85, 247, 0.45);
  }
  .btn-shop:hover {
    border-color: #a855f7;
    box-shadow: 0 0 22px rgba(168, 85, 247, 0.55);
  }
  .btn-shop .hud-icon, .btn-shop .hud-label {
    color: #c084fc;
  }

  /* 3. CENTER: HUB (Row 2, Col 2 - Rounded square, NOT rotated) */
  .btn-hub {
    grid-column: 2;
    grid-row: 2;
    z-index: 10;
    width: 76px;
    height: 76px;
    border-radius: 18px;
    background: #09090b;
    border: 2px solid rgba(34, 211, 238, 0.8);
    box-shadow: 0 0 25px rgba(34, 211, 238, 0.35);
    overflow: hidden;
  }
  .btn-hub:hover {
    border-color: #67e8f9;
    box-shadow: 0 0 35px rgba(34, 211, 238, 0.7);
  }
  .btn-hub .diamond-content {
    transform: none; /* No counter-rotation needed */
  }
  .btn-hub .hud-icon {
    width: 28px;
    height: 28px;
    color: #67e8f9;
  }
  .hub-label {
    font-size: 10px;
    font-weight: 900;
    color: #67e8f9;
    letter-spacing: 0.1em;
  }
  .hub-backdrop {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(6, 182, 212, 0.25) 0%, transparent 100%);
    pointer-events: none;
  }

  /* 4. RIGHT: DEF (Row 2, Col 3) */
  .btn-def {
    grid-column: 3;
    grid-row: 2;
    background: linear-gradient(135deg, rgba(5, 150, 105, 0.35) 0%, #18181b 100%);
    border-color: rgba(52, 211, 153, 0.45);
  }
  .btn-def:hover {
    border-color: #34d399;
    box-shadow: 0 0 22px rgba(52, 211, 153, 0.55);
  }
  .btn-def .hud-icon, .btn-def .hud-label {
    color: #6ee7b7;
  }

  /* 5. BOTTOM: SCOUT (Row 3, Col 2) */
  .btn-scout {
    grid-column: 2;
    grid-row: 3;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.35) 0%, #18181b 100%);
    border-color: rgba(59, 130, 246, 0.45);
  }
  .btn-scout:hover {
    border-color: #60a5fa;
    box-shadow: 0 0 22px rgba(59, 130, 246, 0.55);
  }
  .btn-scout .hud-icon, .btn-scout .hud-label {
    color: #93c5fd;
  }
  .opponent-deck-panel {
    left: calc(300px + 2.5rem) !important;
    border-color: rgba(244, 63, 94, 0.4);
    box-shadow: 0 16px 40px rgba(225, 29, 72, 0.25);
  }
  .badge-enemy {
    font-size: 8px;
    font-weight: 800;
    color: #fda4af;
    background: rgba(136, 19, 55, 0.7);
    border: 1px solid rgba(244, 63, 94, 0.5);
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.05em;
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