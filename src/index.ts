import type { TransactionOptions, TransactionResult, BlsquiStatus, BlsquiDisplayMode } from './types.js';

export * from './types.js';

/**
 * BlsquiSDK
 */
export class BlsquiSDK {
  // --- エンドポイント設定 ---
  public static readonly MAINNET_GATEWAY_URL: string = 'https://wallet.blsqui.net/transaction';
  public static readonly TESTNET_GATEWAY_URL: string = 'https://lab.blsqui.net/transaction';
  public static readonly MAINNET_POLL_API: string = 'https://wallet.blsqui.net/api/status';
  public static readonly TESTNET_POLL_API: string = 'https://lab.blsqui.net/api/status';

  public static readonly DEFAULT_FLIX_ID: string = '7d9d4b154547d7f6ec95e8b95741ed84663592d8c0016dbc4b28b6f9bf435ba5'; // Default FLIXテンプレート (10 FLOW entry fee)
  public static readonly POLL_INTERVAL_MS: number = 1500; // 1.5秒間隔ポーリングでステータスを確認
  public static readonly TIMEOUT_SECONDS: number = 300.0; // ポーリング最大待機時間（5分）

  // --- 状態管理（モーダル・通信 制御） ---
  private static activeModal: HTMLElement | null = null;
  private static activeIframeOverlay: HTMLElement | null = null;
  private static isCanceled: boolean = false;
  private static activePopupWindow: Window | null = null; // window.closeを検知する
  private static popupCheckTimer: number | null = null;
  private static iframeMessageHandler: ((event: MessageEvent) => void) | null = null;

  /**
   * トランザクション要求を発行します。
   * 署名画面を起動し、トランザクションがオンチェーンで確定（SEALED）するまで非同期で監視する。
   * @param options 各種設定オプション
   * @returns トランザクションの実行結果（ステータス、TxID、決済情報など）
   */
  static async requestTransaction(options: TransactionOptions = {}): Promise<TransactionResult> {
    const isTestnet = options.isTestnet ?? true;                                     // テストネットかメインネットか
    const useDefaultModal = options.useDefaultModal ?? true;                         // デフォルトのモーダルを使用するかどうか
    const { isMobile, isIOS, isLocalhost } = this.getDeviceInfo();
    const displayMode: BlsquiDisplayMode = options.displayMode ?? (isMobile || isIOS || isLocalhost ? 'tab' : 'iframe'); // IFrame or Tab

    const verbose = options.verbose ?? false;                                        // Verboseフラグ

    const baseUrl = isTestnet ? this.TESTNET_GATEWAY_URL : this.MAINNET_GATEWAY_URL; // エンドポイント確定
    const flixId = options.flixId || (useDefaultModal ? this.DEFAULT_FLIX_ID : '');  // FLIX ID確定
    const mergedArgs: Record<string, string | number> = { ...(options.args || {}) }; // トランザクション引数（args）

    const currentNonce = await this.generateClientNonce(); // トランザクション識別番号
    const currentTime = Math.floor(Date.now() / 1000);     // 発行日時のタイムスタンプ

    // URLクエリパラメータの構築
    const params = new URLSearchParams({
      flix: flixId,
      issued_time: String(currentTime),
      nonce: currentNonce
    });

    // 任意の追加引数をクエリパラメータへ
    for (const [key, val] of Object.entries(mergedArgs)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        params.set(key, String(val));
      }
    }
    const fullUrl = `${baseUrl}?${params.toString()}`;

    if (verbose) {
      console.log(`[BlsquiSDK] Mode: ${useDefaultModal ? 'DefaultModal' : 'CustomModal'} [${displayMode}]`);
      console.log(`[BlsquiSDK] Wallet Gateway URL: ${fullUrl}`);
    }

    if (!useDefaultModal) {
      // パターンA: 独自UIを使用（即時起動）
      this.isCanceled = false;
      this.launchGateway(fullUrl, displayMode, () => {
        this.cancelTransaction();
      });
      return this.pollTransactionStatus(isTestnet, currentNonce, verbose);
    } else {
      // パターンB: 組み込みモーダルを表示
      return new Promise<TransactionResult>((resolve) => {
        this.isCanceled = false;

        this.showDefaultConfirmationModal({
          modalContent: options.modalContent,
          onCancel: () => {
            this.cancelTransaction();
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

            if (displayMode === 'iframe') {
              this.openGatewayIframe(fullUrl);
            } else {
              // タブ起動：ユーザーがタブを閉じた時にキャンセルを発火
              this.openGatewayTab(fullUrl, () => {
                this.cancelTransaction();
                resolve({
                  status: 'CANCELED',
                  nonce: currentNonce,
                  error: 'Signer window was closed by user.'
                });
              });
            }

            // オンチェーン確定までステータスを監視
            const result = await this.pollTransactionStatus(isTestnet, currentNonce, verbose);
            this.closeModal();
            resolve(result);
          }
        });
      });
    }
  }

  /**
   * 指定された表示モード（別タブ または iframe）で署名画面を展開します。
   */
  private static launchGateway(url: string, mode: BlsquiDisplayMode, onClose?: () => void): void {
    if (mode === 'iframe') {
      this.openGatewayIframe(url);
    } else {
      this.openGatewayTab(url, onClose);
    }
  }

  /**
   * 実行環境のデバイスおよびOS特性を判定します。
   * iPadOS（MacIntel偽装）と実機Macの判別、およびiOS/Androidモバイルの検出を行います。
   */
  public static getDeviceInfo(): {
    isMobile: boolean;
    isIOS: boolean;
    isMac: boolean;
    isLocalhost: boolean;
  } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { isMobile: false, isIOS: false, isMac: false, isLocalhost: false };
    }

    const ua = navigator.userAgent || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const hostname = window.location.hostname || '';

    // localhost / local loopback / 開発IPアドレスを検出する
    const isLocalhost = Boolean(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );

    // iPhone / iPod の直接判定
    const isDirectIOS = /iPhone|iPod/.test(ua);

    // iPad と Mac の判別
    // iPadOS は Safari のデスクトップ表示モードで UA が "Macintosh" / "MacIntel" に偽装されるが、
    // マルチタッチ対応スクリーン（maxTouchPoints >= 1）を持つ。
    // 実機の Mac はタッチパネル非対応のため maxTouchPoints は 0。
    const isIPad = /Macintosh/.test(ua) && maxTouchPoints > 1;

    // iOS（iPhone/iPad）の確定判定
    const isIOS = isDirectIOS || isIPad;

    // Mac判定: UA が "Macintoshを持ち, タッチパネル非対応のため maxTouchPoints は 0
    const isMac = !isIOS && /Macintosh/.test(ua);

    // モバイル全体の判定（iOS + Android + 各種モバイルUA）
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);

    return { isMobile, isIOS, isMac, isLocalhost };
  }

  /**
   * 署名画面（ゲートウェイ）をページ内のiframeモーダルとして展開します。
   *
   * 【利用上の注意点 / 動作仕様】
   * - 画面遷移を発生させず、同一ページ内でシームレスな決済UIを提供します。
   * - 【推奨環境】主にデスクトップ版のモダンブラウザ（Chrome, Edge等）を対象としています。
   *   ※ iOS Safari や一部のモバイルブラウザでは、WebKitのセキュリティ制限（トラッキング防止機構や
   *   サードパーティコンテキスト分離）により生体認証シート（Face ID / Touch ID）が起動しないケースがあるため、
   *   モバイル環境や汎用Webサイトでは標準のタブ/ポップアップ方式（openGatewayTab）を推奨します。
   */
  private static openGatewayIframe(url: string): void {
    this.closeIframe();

    // iframe内からのキャンセル通知を待ち受ける
    this.iframeMessageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'BLSQUI_CANCEL') {
        this.cancelTransaction();
      }
    };

    window.addEventListener('message', this.iframeMessageHandler);
    // 背景オーバーレイ（背景の暗転・blur処理）の生成
    const overlay = document.createElement('div');
    overlay.id = 'blsqui-iframe-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
      padding: 16px;
    `;

    // モーダルフレームの生成
    const frameContainer = document.createElement('div');
    frameContainer.style.cssText = `
      position: relative; width: 100%; max-width: 430px; height: 680px; max-height: 97vh;
      background-color: #0f141c; border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    `;

    // 閉じるボタンの生成
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.setAttribute('aria-label', 'Close checkout');
    closeBtn.style.cssText = `
      position: absolute; top: 5px; right: 17px; z-index: 10;
      width: 28px; height: 28px; border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(0, 0, 0, 0.5);
      color: #cbd5e1; font-size: 13px; font-weight: bold; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0; line-height: 1;
    `;
    closeBtn.onclick = () => {
      this.cancelTransaction();
    };

    // iframeの生成
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    // クロスオリジン環境におけるWebAuthn（パスキー）権限ポリシーとクリップボード操作許可ポリシーを設定
    iframe.allow = 'publickey-credentials-get *; publickey-credentials-create *; clipboard-write *';

    // DOMツリーへ配置
    frameContainer.appendChild(closeBtn);
    frameContainer.appendChild(iframe);
    overlay.appendChild(frameContainer);
    document.body.appendChild(overlay);

    this.activeIframeOverlay = overlay;
  }

  /**
   * 署名画面（ゲートウェイ）をポップアップ（中央配置）/ 別タブのウィンドウで開きます。
   * Safari / iOSにおけるパスキー（WebAuthn）認証の制限を回避するための推奨設定です。
   */
  private static openGatewayTab(url: string, onTabClosed?: () => void): void {
    const width = 430;
    const height = 650;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    this.activePopupWindow = window.open(
      url,
      'BlsquiWallet',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,resizable=yes`
    );

    // ポップアップタブがユーザーによって閉じられたかを監視
    if (this.popupCheckTimer) {
      window.clearInterval(this.popupCheckTimer);
    }

    if (this.activePopupWindow) {
      this.popupCheckTimer = window.setInterval(() => {
        if (this.activePopupWindow && this.activePopupWindow.closed) {
          if (this.popupCheckTimer) {
            window.clearInterval(this.popupCheckTimer);
            this.popupCheckTimer = null;
          }
          this.activePopupWindow = null;
          if (onTabClosed) {
            onTabClosed();
          }
        }
      }, 800);
    }
  }

  /**
   * NonceをもとにバックエンドAPIを定期監視し、トランザクションの確定状態を取得します。
   */
  private static async pollTransactionStatus(
    isTestnet: boolean,
    nonce: string,
    verbose: boolean
  ): Promise<TransactionResult> {
    const pollBase = isTestnet ? this.TESTNET_POLL_API : this.MAINNET_POLL_API;
    const pollUrl = `${pollBase}?nonce=${encodeURIComponent(nonce)}`;
    const startTime = Date.now();
    const timeoutMs = this.TIMEOUT_SECONDS * 1000;

    while (Date.now() - startTime < timeoutMs) {
      if (this.isCanceled) {
        return { status: 'CANCELED', nonce, error: 'Transaction canceled by user.' };
      }

      try {
        // バックエンドのステータス確認ポーリング
        const res = await fetch(pollUrl, {
          headers: { Accept: 'application/json' }
        });

        if (res.status === 200) {
          const data = await res.json();
          const status = String(data.status || 'PENDING').toUpperCase() as BlsquiStatus;

          if (verbose) {
            console.log(`[BlsquiSDK Poll] Status: '${status}'`, data);
          }

          // ステータスの判定
          if (status === 'SEALED') {
            // トランザクション失敗時
            if (data.errorMessage) {
              return {
                status: 'FAILED',
                txId: data.txId || '',                // Flowブロックチェーン上のトランザクションID
                nonce,                                // トランザクション識別番号
                payer: data.payer || '',              // 署名実行者のアカウントアドレス
                error: 'On-chain execution failed',
                errorMessage: data.errorMessage       // ブロックチェーンノードから返されたエラー詳細
              };
            }
            // トランザクション成功時
            return {
              status,
              txId: data.txId || '',                   // Flowブロックチェーン上のトランザクションID
              nonce,                                   // トランザクション識別番号
              errorMessage: null,
              payer: data.payer || '',                 // 署名実行者のアカウントアドレス
              to: data.to || '',                       // イベント (TokensDeposited) から抽出された受取先アドレス。(toという引数があり、かつ振込先アドレスを指定していると格納されます)
              amount: String(data.amount || '0.0'),    // イベント (TokensDeposited/TokensWithdrawn) から抽出された実際の決済額 (Cadence UFix64)
              token: data.token || ''                  // 決済に使用されたトークン識別子 (例: FlowToken、PYUSD)
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
          return { status: 'CANCELED', nonce, error: 'Polling canceled by user.' };
        }
        return { status: 'FAILED', nonce, error: err?.message || 'Network request failed' };
      }
      // 次回ポーリングまでの待機インターバル
      await new Promise((r) => setTimeout(r, this.POLL_INTERVAL_MS));
    }

    return {
      status: 'TIMEOUT',
      nonce,
      error: `Transaction poll timed out after ${this.TIMEOUT_SECONDS} seconds.`
    };
  }

  /**
   * トランザクション一意識別用の256ビット暗号学的Nonce（64文字の16進数文字列）を生成します。
   */
  static async generateClientNonce(): Promise<string> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const hashBuffer = await crypto.subtle.digest('SHA-256', randomBytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 現在開いているすべてのモーダル、iframe、ポップアップウィンドウを閉じます。
   */
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

  /**
   * マウント中のiframeオーバーレイを削除する。
   */
  private static closeIframe(): void {
    if (this.activeIframeOverlay) {
      this.activeIframeOverlay.remove();
      this.activeIframeOverlay = null;
    }
  }

  /**
   * 実行中のトランザクションポーリングを中断し、モーダルを閉じる。
   */
  static cancelTransaction(): void {
    this.isCanceled = true;
    this.closeModal();
  }


  /**
   * 組み込みの確認モーダルダイアログを描画・表示する。
   */
  private static showDefaultConfirmationModal({
    modalContent,
    onCancel,
    onConfirm
  }: {
    modalContent?: TransactionOptions['modalContent'];
    onCancel: () => void;
    onConfirm: (setLoading: (loading: boolean) => void) => void;
  }): void {
    this.closeModal();

    const content = modalContent || {};
    const icon = content.icon ?? '🏆';
    const title = content.title ?? 'Tournament Entry';
    const lead = content.leadText ?? 'Would you like to enter the Tournament?';
    const sub = content.subText ?? `Entry requires payment of an entry fee (10 FLOW).`;
    const cancelText = content.cancelLabel ?? 'Cancel';
    const confirmText = content.confirmLabel ?? 'OK';
    const pendingConfirmText = content.pendingConfirmLabel ?? 'Connecting...';
    const pendingCancelText = content.pendingCancelLabel ?? 'Cancel';

    const overlay = document.createElement('div');
    overlay.id = 'blsqui-dialog-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
      padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", Meiryo, sans-serif;
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
        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">${sub}</p>
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
          confirmBtn.innerText = pendingConfirmText;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.style.cursor = 'not-allowed';

          cancelBtn.innerText = pendingCancelText;
          cancelBtn.style.color = '#ef4444';
          cancelBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          cancelBtn.onclick = () => {
            this.cancelTransaction();
          };
        }
      });
    };
  }
}

export default BlsquiSDK;