import type { TransactionOptions, TransactionResult, BlsquiStatus, BlsquiDisplayMode } from './types.js';

export * from './types.js';

export class BlsquiSDK {
  public static readonly MAINNET_SIGNER_URL: string = 'https://wallet.blsqui.net/transaction';
  public static readonly TESTNET_SIGNER_URL: string = 'https://lab.blsqui.net/transaction';

  public static readonly MAINNET_POLL_API: string = 'https://signer.blsqui.net/api/status';
  public static readonly TESTNET_POLL_API: string = 'https://testnet-signer.blsqui.net/api/status';

  public static readonly TESTNET_DEFAULT_TO: string = '0xa090f900023d6d34';
  public static readonly MAINNET_DEFAULT_TO: string = '0xbba8a05053aef5de';

  public static readonly DEFAULT_FLIX_ID: string = '6aae990ef2619581c28acbc4ac09594d4e9c3e0829bd5533eed88214ea6b3c3d';
  public static readonly DEFAULT_AMOUNT: number = 10.0;

  public static readonly POLL_INTERVAL_MS: number = 1500;
  public static readonly TIMEOUT_SECONDS: number = 300.0;

  private static activeModal: HTMLElement | null = null;
  private static activeIframeOverlay: HTMLElement | null = null;
  private static activeAbortController: AbortController | null = null;
  private static activePopupWindow: Window | null = null;

  static async requestTransaction(options: TransactionOptions = {}): Promise<TransactionResult> {
    const isTestnet = options.isTestnet ?? true;
    const useDefaultModal = options.useDefaultModal ?? true;
    const displayMode: BlsquiDisplayMode = options.displayMode ?? 'tab';
    const verbose = options.verbose ?? false;

    // 1. Resolve Target Signer Base URL
    const baseUrl = isTestnet ? this.TESTNET_SIGNER_URL : this.MAINNET_SIGNER_URL;

    // 2. Resolve FLIX ID
    const flixId = options.flixId || (useDefaultModal ? this.DEFAULT_FLIX_ID : '');

    // 3. Consolidate args (amount and destination merged into args)
    const mergedArgs: Record<string, string | number> = { ...(options.args || {}) };

    // Resolve 'to' (destination)
    if (options.destination) {
      mergedArgs.to = options.destination;
    } else if (useDefaultModal && !mergedArgs.to) {
      mergedArgs.to = isTestnet ? this.TESTNET_DEFAULT_TO : this.MAINNET_DEFAULT_TO;
    }

    // Resolve 'price' (amount)
    if (options.amount !== undefined) {
      mergedArgs.price = String(options.amount);
    } else if (useDefaultModal && mergedArgs.price === undefined) {
      mergedArgs.price = String(this.DEFAULT_AMOUNT);
    }

    // 4. Generate Nonce & Timestamp
    const currentNonce = await this.generateClientNonce();
    const currentTime = Math.floor(Date.now() / 1000);

    // 5. Build URL Query Parameters
    const params = new URLSearchParams({
      flix: flixId,
      issued_time: String(currentTime),
      nonce: currentNonce
    });

    // Append all transaction arguments
    for (const [key, val] of Object.entries(mergedArgs)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        params.set(key, String(val));
      }
    }

    const fullUrl = `${baseUrl}?${params.toString()}`;

    if (verbose) {
      console.log(`[BlsquiSDK] Mode: ${useDefaultModal ? 'DefaultModal' : 'CustomModal'} [${displayMode}]`);
      console.log(`[BlsquiSDK] Signer URL: ${fullUrl}`);
    }

    // Mode A: Skip default confirmation modal -> open directly via chosen displayMode
    if (!useDefaultModal) {
      this.launchSigner(fullUrl, displayMode);
      return this.pollTransactionStatus(isTestnet, currentNonce, verbose);
    }

    // Mode B: Show default confirmation modal first
    const displayPrice = String(mergedArgs.price ?? this.DEFAULT_AMOUNT);

    return new Promise<TransactionResult>((resolve) => {
      this.showConfirmationModal({
        amount: displayPrice,
        modalContent: options.modalContent,
        onCancel: () => {
          this.closeModal();
          resolve({
            status: 'CANCELED',
            nonce: currentNonce,
            error: 'User canceled transaction'
          });
        },
        onConfirm: async (setLoading) => {
          setLoading(true);

          if (verbose) {
            console.log(`[BlsquiSDK] Launching signer via [${displayMode}]: ${fullUrl}`);
          }

          this.launchSigner(fullUrl, displayMode);

          const result = await this.pollTransactionStatus(isTestnet, currentNonce, verbose);
          this.closeModal();
          resolve(result);
        }
      });
    });
  }

  private static launchSigner(url: string, mode: BlsquiDisplayMode): void {
    if (mode === 'iframe') {
      this.mountSignerIframe(url);
    } else {
      this.openSignerPopup(url);
    }
  }

  private static openSignerPopup(url: string): void {
    const width = 460;
    const height = 740;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    this.activePopupWindow = window.open(
      url,
      'BlsquiCheckout',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,resizable=yes`
    );
  }

  private static mountSignerIframe(url: string): void {
    this.closeIframe();

    const overlay = document.createElement('div');
    overlay.id = 'blsqui-iframe-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
      padding: 16px;
    `;

    const frameContainer = document.createElement('div');
    frameContainer.style.cssText = `
      position: relative; width: 100%; max-width: 440px; height: 680px; max-height: 90vh;
      background-color: #0f141c; border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.setAttribute('aria-label', 'Close checkout');
    closeBtn.style.cssText = `
      position: absolute; top: 12px; right: 12px; z-index: 10;
      width: 28px; height: 28px; border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(0, 0, 0, 0.5);
      color: #cbd5e1; font-size: 13px; font-weight: bold; cursor: pointer;
    `;
    closeBtn.onclick = () => {
      this.cancelTransaction();
      this.closeIframe();
    };

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.allow = 'publickey-credentials-get *; publickey-credentials-create *; clipboard-write *';

    frameContainer.appendChild(closeBtn);
    frameContainer.appendChild(iframe);
    overlay.appendChild(frameContainer);
    document.body.appendChild(overlay);

    this.activeIframeOverlay = overlay;
  }

  private static showConfirmationModal({
    amount,
    modalContent,
    onCancel,
    onConfirm
  }: {
    amount: string;
    modalContent?: TransactionOptions['modalContent'];
    onCancel: () => void;
    onConfirm: (setLoading: (loading: boolean) => void) => void;
  }): void {
    this.closeModal();

    const content = modalContent || {};
    const icon = content.icon ?? '🏆';
    const title = content.title ?? 'Tournament Entry';
    const lead = content.leadText ?? 'Would you like to enter the Tournament?';
    const sub = content.subText ?? `Entry requires payment of an entry fee (${amount} FLOW).`;
    const cancelText = content.cancelLabel ?? 'Cancel';
    const confirmText = content.confirmLabel ?? 'OK';

    const overlay = document.createElement('div');
    overlay.id = 'blsqui-dialog-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
      padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: 100%; max-width: 380px; background: #111827;
      border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 14px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(99, 102, 241, 0.15);
      padding: 24px; box-sizing: border-box; color: #f8fafc;
      animation: blsqui-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    if (!document.getElementById('blsqui-keyframes')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'blsqui-keyframes';
      styleEl.textContent = `
        @keyframes blsqui-pop {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <span style="font-size: 22px;">${icon}</span>
        <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.02em;">${title}</h2>
      </div>
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #e2e8f0;">${lead}</p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">${sub}</p>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button id="blsqui-btn-cancel" type="button" style="
          padding: 9px 18px; font-size: 13px; font-weight: 600; color: #94a3b8;
          background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px; cursor: pointer; transition: all 0.15s ease;
        ">${cancelText}</button>
        <button id="blsqui-btn-confirm" type="button" style="
          padding: 9px 24px; font-size: 13px; font-weight: 700; color: #ffffff;
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          border: none; border-radius: 8px; cursor: pointer;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); transition: all 0.15s ease;
        ">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.activeModal = overlay;

    const cancelBtn = card.querySelector('#blsqui-btn-cancel') as HTMLButtonElement;
    const confirmBtn = card.querySelector('#blsqui-btn-confirm') as HTMLButtonElement;

    cancelBtn.onclick = () => onCancel();

    confirmBtn.onclick = () => {
      onConfirm((loading) => {
        if (loading) {
          confirmBtn.disabled = true;
          confirmBtn.innerText = 'Connecting...';
          confirmBtn.style.opacity = '0.6';
          cancelBtn.style.display = 'none';
        }
      });
    };
  }

  private static async pollTransactionStatus(
    isTestnet: boolean,
    nonce: string,
    verbose: boolean
  ): Promise<TransactionResult> {
    const pollBase = isTestnet ? this.TESTNET_POLL_API : this.MAINNET_POLL_API;
    const pollUrl = `${pollBase}?nonce=${encodeURIComponent(nonce)}`;
    const startTime = Date.now();
    const timeoutMs = this.TIMEOUT_SECONDS * 1000;

    this.activeAbortController = new AbortController();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await fetch(pollUrl, {
          signal: this.activeAbortController.signal,
          headers: { Accept: 'application/json' }
        });

        if (res.status === 200) {
          const data = await res.json();
          const status = String(data.status || 'PENDING').toUpperCase() as BlsquiStatus;

          if (verbose) {
            console.log(`[BlsquiSDK Poll] Status: '${status}'`, data);
          }

          if (['SEALED', 'EXECUTED', 'FINALIZED', 'SUCCESS'].includes(status)) {
            return {
              status,
              txId: data.txId || '',
              nonce,
              errorMessage: data.errorMessage || null,
              payer: data.payer || '',
              to: data.to || '',
              amount: String(data.amount || '0.0'),
              token: data.token || 'FLOW'
            };
          } else if (status === 'EXPIRED') {
            return {
              status: 'EXPIRED',
              nonce,
              error: 'Transaction expired on-chain'
            };
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { status: 'FAILED', nonce, error: 'Polling canceled by user.' };
        }
      }

      await new Promise((r) => setTimeout(r, this.POLL_INTERVAL_MS));
    }

    return {
      status: 'TIMEOUT',
      nonce,
      error: `Transaction poll timed out after ${this.TIMEOUT_SECONDS} seconds.`
    };
  }

  static async generateClientNonce(): Promise<string> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const hashBuffer = await crypto.subtle.digest('SHA-256', randomBytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static closeModal(): void {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
    this.closeIframe();
    if (this.activePopupWindow && !this.activePopupWindow.closed) {
      this.activePopupWindow.close();
      this.activePopupWindow = null;
    }
  }

  private static closeIframe(): void {
    if (this.activeIframeOverlay) {
      this.activeIframeOverlay.remove();
      this.activeIframeOverlay = null;
    }
  }

  static cancelTransaction(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.closeModal();
  }
}

export default BlsquiSDK;