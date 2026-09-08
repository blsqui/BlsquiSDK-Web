// トランザクションの処理ステータス
export type BlsquiStatus =
  // --- Flowブロックチェーン上の確定状態 ---
  | 'PENDING'
  | 'FINALIZED'  // コンセンサスノードによる承認完了・実行待ち
  | 'EXECUTED'
  | 'SEALED'
  | 'EXPIRED'
  | 'FAILED'     // トランザクション失敗
  // --- SDKクライアント側のライフサイクル状態 ---
  | 'TIMEOUT'    // ポーリング規定時間（デフォルト300秒）の超過
  | 'CANCELED';  // ユーザーによる手動キャンセル

// 署名画面の表示モード
export type BlsquiDisplayMode = 'iframe' | 'tab';

// トランザクション要求時の設定オプション
export interface TransactionOptions {
  // 接続先ネットワーク環境の指定
  isTestnet?: boolean;

  // 組み込みの確認モーダルを表示するかどうか
  useDefaultModal?: boolean;

  // ゲートウェイの展開方式
  // - 'tab': ポップアップウィンドウ（iOS Safari / Android 等の生体認証に最適）
  // - 'iframe': ページ内オーバーレイ (デスクトップ環境向け)
  displayMode?: BlsquiDisplayMode;

  // 実行対象のFLIX（Flow Interaction Template）ID
  // 未指定かつ useDefaultModal が true の場合は、デフォルトのFLIX ID(10 FLOW entry fee)が適用されます。
  flixId?: string;

  // FLIXテンプレートに渡す実行引数（Key-Value形式）
  // @example { to: '0xa090...', itemId: 'item_01' }
  args?: Record<string, string | number>;

  // 確認モーダルのテキスト・アイコンのカスタマイズ設定
  modalContent?: ModalContentConfig;

  // コンソールログの詳細出力を有効化するかどうか
  verbose?: boolean;
}

/**
 * トランザクション実行結果
 */
export interface TransactionResult {
  /** 最終実行ステータス（SEALED, EXECUTED 等） */
  status: BlsquiStatus;
  /** Flowブロックチェーン上のトランザクションID（オンチェーン証明） */
  txId?: string;
  /** トランザクション識別番号 (Nonce) */
  nonce: string;
  /** パスキー署名を実行したアカウントアドレス */
  payer?: string;
  /** オンチェーンイベント（TokensDeposited）から抽出された実際の受取先アドレス */
  to?: string;
  /** オンチェーンイベントから抽出された確定送金額（Cadence UFix64） */
  amount?: string;
  /** 決済に使用されたトークン識別子（例: FlowToken, PYUSD） */
  token?: string;
  /** SDK側で検知されたエラー内容（キャンセル・タイムアウト等） */
  error?: string;
  /** ブロックチェーンノードから返却されたエラー詳細メッセージ */
  errorMessage?: string | null;
}


// 組み込み確認モーダルの文言およびアイコンのカスタマイズ設定
export interface ModalContentConfig {
  /** ダイアログヘッダーに表示する絵文字またはアイコン文字列（デフォルト: "🏆"） */
  icon?: string;
  /** モーダルのタイトル文言（デフォルト: "Tournament Entry"） */
  title?: string;
  /** 主要な説明・リードテキスト（デフォルト: "Would you like to enter the Tournament?"） */
  leadText?: string;
  /** 補足説明文（デフォルト: "Entry requires payment of an entry fee (10 FLOW)."） */
  subText?: string;
  /** 確定・承認ボタンのラベル（デフォルト: "OK"） */
  confirmLabel?: string;
  /** キャンセルボタンのラベル（デフォルト: "Cancel"） */
  cancelLabel?: string;
  /** 署名待ち受け中の確定ボタンラベル（デフォルト: "Connecting..."） */
  pendingConfirmLabel?: string;
  /** 署名待ち受け中のキャンセルボタンラベル（デフォルト: "Cancel"） */
  pendingCancelLabel?: string;
}
