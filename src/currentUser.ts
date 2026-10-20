export interface BlsquiConfig {
  appId: string;
  publisherAddress: string;
  network?: 'testnet' | 'mainnet';
}

export interface SlotItem {
  slotIndex: number;
  itemId?: string;
  itemName?: string;
  icon?: string;
  category?: string;
  remainingCharges?: number;
  maxCharges?: number;
  flixId?: string;
  publisherAddress?: string;
}

export interface CurrentUserSession {
  addr: string | null;
  avatarImage?: string | null;
  userName?: string | null;
  loggedIn: boolean;
  network: 'testnet' | 'mainnet';
  slot: SlotItem[] | null;
  dashboardOpen: boolean;
  lastUsedItem?: {
    itemId: string;
    serialNumber: number;
    txId: string;
  } | null;
}

export interface ScoutItemResult {
  slotIndex: number;
  itemId: string;
}

export type UserSubscriptionCallback = (user: CurrentUserSession) => void;
import { WebRTCPresence } from './webRTCPresence';

export class CurrentUserManager {
  private static instance: CurrentUserManager | null = null;

  private config: BlsquiConfig = {
    appId: '',
    publisherAddress: '',
    network: 'testnet'
  };

  private userState: CurrentUserSession = {
    addr: null,
    loggedIn: false,
    network: 'testnet',
    slot: null,
    dashboardOpen: false
  };

  private presence = new WebRTCPresence();
  private sessionChannelKey: string | null = null;
  private currentSecureRoom: string | null = null;
  private subscribers: Set<UserSubscriptionCallback> = new Set();
  private dashboardWindow: Window | null = null;
  private activeIframeContainer: HTMLElement | null = null;
  private activeIframeWindow: Window | null = null;
  private isListeningToDashboard: boolean = false;
  private heartbeatInterval: any = null;

  private constructor() {
    this.initPresenceListener();
  }

  public static getInstance(): CurrentUserManager {
    if (!CurrentUserManager.instance) {
      CurrentUserManager.instance = new CurrentUserManager();
    }
    return CurrentUserManager.instance;
  }

  public setConfig(cfg: BlsquiConfig): void {
    this.config = {
      appId: cfg.appId ? cfg.appId.toLowerCase().trim() : '',
      publisherAddress: cfg.publisherAddress ? cfg.publisherAddress.trim() : '',
      network: cfg.network || 'testnet'
    };
    this.userState.network = this.config.network!;
  }

  public getConfig(): BlsquiConfig {
    return { ...this.config };
  }

  // Generate 256-bit cryptographically secure hex key
  private generateSecureChannelKey(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(16).substring(2) + Date.now().toString(16);
  }

  public getOrCreateChannelKey(): string {
    if (!this.sessionChannelKey) {
      this.sessionChannelKey = this.generateSecureChannelKey();
    }
    return this.sessionChannelKey;
  }

  // Derive SHA-256(channelKey : userAddress)
  public async deriveSecureRoomId(addr: string, key: string): Promise<string> {
    const cleanAddr = addr.toLowerCase().trim();
    if (!key) return cleanAddr;
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${key}:${cleanAddr}`)
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public subscribe(callback: UserSubscriptionCallback): () => void {
    this.subscribers.add(callback);
    callback(this.userState);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public snapshot(): CurrentUserSession {
    return { ...this.userState };
  }

  public setState(updates: Partial<CurrentUserSession>): void {
    const prevLoggedIn = this.userState.loggedIn;

    this.userState = {
      ...this.userState,
      ...updates,
      loggedIn: Boolean(updates.addr ?? this.userState.addr)
    };

    // Auto-manage heartbeat when session login state flips
    if (!prevLoggedIn && this.userState.loggedIn) {
      this.startHostPresenceHeartbeat();
    } else if (prevLoggedIn && !this.userState.loggedIn) {
      this.stopHostPresenceHeartbeat();
    }

    for (const sub of this.subscribers) {
      sub(this.userState);
    }
  }

  public openDashboard(options: { width?: number; height?: number } = {}): Window | null {
    if (typeof window === 'undefined') return null;

    const isTestnet = this.config.network !== 'mainnet';
    const baseUrl = isTestnet ? 'https://lab.blsqui.net' : 'https://wallet.blsqui.net';

    const params = new URLSearchParams();
    if (this.config.appId) params.set('app_id', this.config.appId);
    if (this.config.publisherAddress) params.set('publisher_address', this.config.publisherAddress);

    const fullUrl = `${baseUrl}/?${params.toString()}`;

    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    const width = options.width ?? Math.floor(screenWidth / 2);
    const height = options.height ?? screenHeight;

    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const left = screenLeft + width;
    const top = window.screenTop !== undefined ? window.screenTop : window.screenY;

    this.dashboardWindow = window.open(
      fullUrl,
      'BlsquiDashboard',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,resizable=yes`
    );

    return this.dashboardWindow;
  }

  public summonDashboard(): void {
    if (typeof document === 'undefined') return;

    if (this.activeIframeContainer) {
      this.closeDashboardIframe();
      return;
    }

    const isTestnet = this.config.network !== 'mainnet';
    const baseUrl = isTestnet ? 'https://lab.blsqui.net' : 'https://wallet.blsqui.net';

    // Generate or retrieve the ephemeral 256-bit random channel key
    const channelKey = this.getOrCreateChannelKey();

    // Connect the game to Pion Hub immediately using the channelKey as the room ID
    if (this.currentSecureRoom !== channelKey) {
      this.currentSecureRoom = channelKey;
      console.log(`[SDK] Connecting game presence to secure room: ${channelKey.slice(0, 8)}...`);
      this.presence.init(channelKey, 'game');
    }

    // Build query params for the iframe
    const params = new URLSearchParams();
    if (this.config.appId) params.set('app_id', this.config.appId);
    if (this.config.publisherAddress) params.set('publisher_address', this.config.publisherAddress);
    if (this.userState.addr) params.set('addr', this.userState.addr);
    params.set('channel_key', channelKey); // Pass channel_key to Dashboard iframe

    const fullUrl = `${baseUrl}/?${params.toString()}`;

    const container = document.createElement('div');
    container.id = 'blsqui-dashboard-iframe-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 50vw;
      height: 100vh;
      height: 100dvh;
      z-index: 99999;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
      border-left: 1px solid rgba(56, 189, 248, 0.3);
      background-color: #0a0d14;
      display: flex;
      flex-direction: column;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.setAttribute('aria-label', 'Close dashboard');
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      left: -40px;
      width: 32px;
      height: 32px;
      border-radius: 8px 0 0 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-right: none;
      background: #11151e;
      color: #cbd5e1;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.closeDashboardIframe();

    const iframe = document.createElement('iframe');
    iframe.title = 'Blsqui Equip Stage';
    iframe.src = fullUrl;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.allow = 'publickey-credentials-get *; publickey-credentials-create *; clipboard-write *';

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    document.body.appendChild(container);

    this.activeIframeContainer = container;
    this.activeIframeWindow = iframe.contentWindow;

    this.setState({ dashboardOpen: true });
  }

  public closeDashboardIframe(): void {
    if (this.activeIframeContainer) {
      this.activeIframeContainer.remove();
      this.activeIframeContainer = null;
      this.activeIframeWindow = null;
      this.setState({ dashboardOpen: false });

      // Clean up presence when iframe is closed
      this.presence.cleanup();
      this.currentSecureRoom = null;
      this.sessionChannelKey = null; // Rotate token on close
    }
  }

  public postMessageToDashboard(message: any, targetOrigin: string = '*'): void {
    if (this.activeIframeWindow) {
      this.activeIframeWindow.postMessage(message, targetOrigin);
    } else if (this.dashboardWindow && !this.dashboardWindow.closed) {
      this.dashboardWindow.postMessage(message, targetOrigin);
    } else {
      const iframeEl = document.querySelector('iframe[title="Blsqui Equip Stage"]') as HTMLIFrameElement | null;
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage(message, targetOrigin);
      }
    }
  }

  private startHostPresenceHeartbeat(): void {
    this.stopHostPresenceHeartbeat();

    // Immediately send pong / live status
    this.sendPresenceLiveSignal();

    // Ping every 10 seconds to keep Dashboard informed
    this.heartbeatInterval = setInterval(() => {
      this.sendPresenceLiveSignal();
    }, 10000);
  }

  private stopHostPresenceHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendPresenceLiveSignal(): void {
    this.postMessageToDashboard({
      type: 'PRESENCE_PONG',
      role: 'game',
      player: this.userState.addr ? this.userState.addr.toLowerCase() : '',
      status: 'LIVE',
      game_online: true,
      timestamp: Date.now()
    });
  }

  private initPresenceListener(): void {
    this.presence.onMessage((msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      // Live Heartbeat / Ping response
      if (msg.type === 'PRESENCE_PING') {
        this.presence.send({
          type: 'PRESENCE_PONG',
          role: 'game',
          player: this.userState.addr ? this.userState.addr.toLowerCase() : '',
          status: 'LIVE',
          game_online: true,
          timestamp: Date.now()
        });
        return;
      }

      // User & Slot Sync from Dashboard over WebRTC
      if (msg.type === 'BLSQUI_USER_UPDATE' || msg.type === 'SLOT_SYNC' || msg.type === 'BLSQUI_SLOT_SYNC') {
        this.setState({
          addr: msg.address || msg.player || this.userState.addr,
          avatarImage: msg.avatarImage ?? msg.avatar_image ?? this.userState.avatarImage,
          userName: msg.userName ?? msg.user_name ?? this.userState.userName,
          slot: msg.slot || msg.slots || [],
          loggedIn: Boolean(msg.address || msg.player || this.userState.addr)
        });
        return;
      }

      // Stage Slot Reorder / Equip from Dashboard over WebRTC
      if (msg.type === 'STAGE_REORDERED' || msg.type === 'ITEM_EQUIPPED') {
        if (Array.isArray(msg.slots)) {
          this.setState({
            slot: msg.slots
          });
        }
        return;
      }

      // Logout event from Dashboard
      if (msg.type === 'BLSQUI_LOGOUT') {
        this.setState({
          addr: null,
          loggedIn: false,
          slot: null,
          avatarImage: null,
          userName: null
        });
        return;
      }

      // Item Use confirmation
      if (msg.type === 'ITEM_USE_COMPLETED') {
        this.setState({
          lastUsedItem: {
            itemId: msg.itemId,
            serialNumber: msg.serialNumber,
            txId: msg.txId
          }
        });
      }
    });
  }

  public async getStageSlots(options: {
    targetAddress: string;
    publisherAddress: string;
    appId?: string;
  }): Promise<SlotItem[]> {
    const isTestnet = this.config.network !== 'mainnet';
    const accessNode = isTestnet
      ? 'https://rest-testnet.onflow.org'
      : 'https://rest-mainnet.onflow.org';

    const sesamePassContract = isTestnet
      ? '0x975b04756864e9ea'
      : '0xb576a3926d239682';

    const cleanTarget = options.targetAddress.startsWith('0x')
      ? options.targetAddress
      : `0x${options.targetAddress}`;
    const cleanPublisher = options.publisherAddress.startsWith('0x')
      ? options.publisherAddress
      : `0x${options.publisherAddress}`;
    const appId = options.appId || this.config.appId;

    const cadenceScript = `
      import SesamePass from ${sesamePassContract}

      access(all) fun main(publisher: Address, user: Address, appId: String): [String]? {
          return SesamePass.getUserItemSlots(publisher: publisher, user: user, appId: appId)
      }
    `;

    try {
      const scriptBase64 = btoa(cadenceScript);

      const res = await fetch(`${accessNode}/v1/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptBase64,
          arguments: [
            btoa(JSON.stringify({ type: 'Address', value: cleanPublisher })),
            btoa(JSON.stringify({ type: 'Address', value: cleanTarget })),
            btoa(JSON.stringify({ type: 'String', value: appId }))
          ]
        })
      });

      if (!res.ok) {
        console.warn('[BlsquiSDK] Failed to query target slots:', await res.text());
        return [];
      }

      const cadenceResponse = await res.json();
      let parsed = cadenceResponse;

      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          try {
            parsed = JSON.parse(atob(parsed.trim()));
          } catch (e) {
            console.error('Failed to parse cadenceResponse string:', e);
            return [];
          }
        }
      }

      const rawArray = parsed?.value?.value || [];

      return rawArray.map((entry: any, idx: number) => ({
        slotIndex: idx + 1,
        itemId: entry?.value || ''
      }));
    } catch (err) {
      console.error('[BlsquiSDK] Error executing getStageSlots:', err);
      return [];
    }
  }
}

export const currentUser = CurrentUserManager.getInstance();
