export interface BlsquiConfig {
  appId: string;
  publisherId: string;
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
}

export type UserSubscriptionCallback = (user: CurrentUserSession) => void;

export class CurrentUserManager {
  private static instance: CurrentUserManager | null = null;

  // Explicitly declared config property
  private config: BlsquiConfig = {
    appId: '',
    publisherId: '',
    network: 'testnet'
  };

  private userState: CurrentUserSession = {
    addr: null,
    loggedIn: false,
    network: 'testnet',
    slot: null,
    dashboardOpen: false
  };

  private subscribers: Set<UserSubscriptionCallback> = new Set();
  private dashboardWindow: Window | null = null;
  private activeIframeContainer: HTMLElement | null = null;
  private activeIframeWindow: Window | null = null;
  private isListeningToDashboard: boolean = false;

  private constructor() {
    this.initMessageListener();
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
      publisherId: cfg.publisherId ? cfg.publisherId.toUpperCase().trim() : '',
      network: cfg.network || 'testnet'
    };
    this.userState.network = this.config.network!;
  }

  public getConfig(): BlsquiConfig {
    return { ...this.config };
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
    this.userState = {
      ...this.userState,
      ...updates,
      loggedIn: Boolean(updates.addr ?? this.userState.addr)
    };

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
    if (this.config.publisherId) params.set('publisher_id', this.config.publisherId);

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

    const params = new URLSearchParams();
    if (this.config.appId) params.set('app_id', this.config.appId);
    if (this.config.publisherId) params.set('publisher_id', this.config.publisherId);

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

    // Notify subscribers that the dashboard is now open
    this.setState({ dashboardOpen: true });
  }

  public closeDashboardIframe(): void {
    if (!this.activeIframeContainer) return;

    // Remove DOM container
    this.activeIframeContainer.remove();
    this.activeIframeContainer = null;
    this.activeIframeWindow = null;

    // Notify subscribers that the dashboard was closed
    this.setState({ dashboardOpen: false });
  }

  public postMessageToDashboard(message: any, targetOrigin: string = '*'): void {
    if (this.activeIframeWindow) {
      this.activeIframeWindow.postMessage(message, targetOrigin);
    } else {
      const iframeEl = document.querySelector('iframe[title="Blsqui Equip Stage"]') as HTMLIFrameElement | null;
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage(message, targetOrigin);
      } else {
        console.warn('[BlsquiSDK] No active dashboard iframe found to receive postMessage.');
      }
    }
  }

  private initMessageListener(): void {
    if (this.isListeningToDashboard || typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      const allowedOrigins = ['https://lab.blsqui.net', 'https://wallet.blsqui.net'];
      const isLocal = event.origin.includes('localhost') || event.origin.includes('127.0.0.1');

      if (!allowedOrigins.includes(event.origin) && !isLocal) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'BLSQUI_USER_UPDATE' || data.type === 'BLSQUI_SLOT_SYNC') {
        this.setState({
            addr: event.data.address || this.userState.addr,
            avatarImage: event.data.avatarImage ?? this.userState.avatarImage,
            userName: event.data.userName ?? this.userState.userName,
            slot: event.data.slot || [],
            loggedIn: Boolean(event.data.address)
        });
      }

      if (data.type === 'BLSQUI_LOGOUT') {
        this.setState({
          addr: null,
          slot: null
        });
      }
    });

    this.isListeningToDashboard = true;
  }
}

export const currentUser = CurrentUserManager.getInstance();
