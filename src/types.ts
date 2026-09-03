export type BlsquiStatus =
  | 'PENDING'
  | 'SEALED'
  | 'EXECUTED'
  | 'FINALIZED'
  | 'SUCCESS'
  | 'EXPIRED'
  | 'TIMEOUT'
  | 'FAILED'
  | 'CANCELED';

export type BlsquiDisplayMode = 'iframe' | 'tab';

export interface ModalContentConfig {
  /** Emoji or icon shown in dialog header (default: "🏆") */
  icon?: string;
  /** Modal title (default: "Tournament Entry") */
  title?: string;
  /** Main lead text */
  leadText?: string;
  /** Subtitle / requirement details */
  subText?: string;
  /** OK button label (default: "OK") */
  confirmLabel?: string;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
}

export interface TransactionOptions {
  /**
   * Flow Testnet (true) or Mainnet (false).
   * Default: true
   */
  isTestnet?: boolean;

  /**
   * Whether to use the built-in Tournament Entry confirmation modal.
   * Default: true
   */
  useDefaultModal?: boolean;

  /**
   * Signer display presentation:
   * - 'tab': Opens dedicated popup window (Safari/WebAuthn safe)
   * - 'iframe': Mounts in-page overlay
   * Default: 'tab'
   */
  displayMode?: BlsquiDisplayMode;

  /**
   * FLIX template ID.
   * Defaults to tournament entry FLIX when useDefaultModal is true.
   */
  flixId?: string;

  /**
   * Arguments passed to the FLIX transaction.
   * For the default modal, `to` and `price` will be automatically populated if omitted.
   * Example: { to: '0xa090...', price: '10.0', itemId: 'nitro' }
   */
  args?: Record<string, string | number>;

  /** Optional convenience shortcut for recipient (merged into args.to) */
  destination?: string;

  /** Optional convenience shortcut for payment amount (merged into args.price) */
  amount?: number | string;

  /** Text & icon customization for the default dialog */
  modalContent?: ModalContentConfig;

  /** Print verbose console logs. Default: false */
  verbose?: boolean;
}

export interface TransactionResult {
  status: BlsquiStatus;
  txId?: string;
  nonce: string;
  errorMessage?: string | null;
  error?: string;
  payer?: string;
  to?: string;
  amount?: string;
  token?: string;
}
