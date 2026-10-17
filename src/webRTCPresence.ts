// webRTCPresence.ts
export type MessageListener = (data: any) => void;

export interface WebRTCPresenceState {
  connected: boolean;
  gameOnline: boolean;
  canUseItem: boolean;
  lastPingMs: number;
}

export type StateListener = (state: WebRTCPresenceState) => void;

export class WebRTCPresence {
  private _state: WebRTCPresenceState = {
    connected: false,
    gameOnline: false,
    canUseItem: false,
    lastPingMs: 0
  };

  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private activeAddress: string | null = null;
  private isConnecting = false;

  /**
   * Current snapshot of the WebRTC connection state
   */
  get state(): Readonly<WebRTCPresenceState> {
    return this._state;
  }

  /**
   * Subscribe to state changes (connected, gameOnline, canUseItem, etc.)
   * Returns an unsubscribe function.
   */
  subscribeState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this._state); // Immediate trigger
    return () => this.stateListeners.delete(fn);
  }

  private updateState(partial: Partial<WebRTCPresenceState>) {
    this._state = { ...this._state, ...partial };
    for (const listener of this.stateListeners) {
      listener(this._state);
    }
  }

  async init(playerAddress: string, role: 'dashboard' | 'game' = 'dashboard'): Promise<void> {
    const cleanAddr = playerAddress?.toLowerCase().trim();

    if (!cleanAddr) {
      console.warn('[WebRTC] Missing player address. Aborting handshake.');
      return;
    }

    // Guard: Prevent reconnecting if already connected or currently negotiating for the same address
    if (this.isConnecting || (this.pc && this.activeAddress === cleanAddr && this._state.connected)) {
      return;
    }

    this.isConnecting = true;
    this.activeAddress = cleanAddr;
    this.cleanup();

    try {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' }
        ]
      });

      this.dc = this.pc.createDataChannel('blsqui-presence', {
        ordered: true
      });

      this.setupDataChannel(this.dc);

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (this.pc?.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (this.pc?.iceGatheringState === 'complete') {
              this.pc?.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          this.pc?.addEventListener('icegatheringstatechange', checkState);
          setTimeout(resolve, 800);
        }
      });

      const payload = {
        role,
        player: cleanAddr,
        sdp: this.pc.localDescription
      };

      const res = await fetch('https://api.blsqui-signer.net/api/rtc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`WebRTC Handshake failed [HTTP ${res.status}]: ${errorText}`);
      }

      const answer = await res.json();
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.updateState({ connected: true });

    } catch (err) {
      console.error('[WebRTC] Handshake error:', err);
      this.updateState({ connected: false });
      this.activeAddress = null;
    } finally {
      this.isConnecting = false;
    }
  }

  onMessage(fn: MessageListener): () => void {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      console.log('✅ [WebRTC DataChannel OPEN]');
      this.updateState({ connected: true });
    };

    dc.onclose = () => {
      console.warn('🛑 [WebRTC DataChannel CLOSED]');
      this.updateState({
        connected: false,
        gameOnline: false,
        canUseItem: false
      });
    };

    dc.onerror = (err) => {
      console.error('❌ [WebRTC DataChannel ERROR]:', err);
    };

    dc.onmessage = (event: MessageEvent) => {
      try {
        let rawText: string;

        if (typeof event.data === 'string') {
          rawText = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          rawText = new TextDecoder('utf-8').decode(event.data);
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            const msg = JSON.parse(text);
            this.handleIncomingMessage(msg);
          });
          return;
        } else {
          rawText = new TextDecoder('utf-8').decode(new Uint8Array(event.data));
        }

        const msg = JSON.parse(rawText);
        console.log('📩 [WebRTC RECV] <- Pion Hub:', msg);
        this.handleIncomingMessage(msg);

      } catch (e) {
        console.error('❌ [WebRTC DataChannel PARSE ERROR]:', event.data, e);
      }
    };
  }

  send(data: any): void {
    if (this.dc && this.dc.readyState === 'open') {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      console.log('📡 [WebRTC SEND] -> Pion Hub:', JSON.parse(payload));
      this.dc.send(payload);
    } else {
      console.warn('⚠️ [WebRTC SEND FAILED] DataChannel state is:', this.dc?.readyState ?? 'null');
    }
  }

  private handleIncomingMessage(msg: any) {
    if (msg.type === 'PRESENCE_UPDATE') {
      this.updateState({
        gameOnline: msg.status === 'GAME_CONNECTED',
        canUseItem: Boolean(msg.can_use_item)
      });
    }

    for (const listener of this.messageListeners) {
      listener(msg);
    }
  }

  cleanup(): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.activeAddress = null;
    this.isConnecting = false;
    this.updateState({
      connected: false,
      gameOnline: false,
      canUseItem: false
    });
  }
}