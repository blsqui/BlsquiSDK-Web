# @blsqui/sdk-web

[![npm version](https://img.shields.io/npm/v/@blsqui/sdk-web.svg)](https://www.npmjs.com/package/@blsqui/sdk-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Flow Blockchain](https://img.shields.io/badge/Flow-Blockchain-00EF8B?logo=flow&logoColor=black)](https://flow.com/)

Official Web SDK for **Blsqui** — Enabling Flow blockchain Passkey authentication, FLIX execution, and in-game transaction dialogs for web games and interactive applications.

`@blsqui/sdk-web` is a zero-dependency, framework-agnostic TypeScript library that runs smoothly across Svelte, React, Vue, Vanilla JS, and canvas game engines (Pixi.js, Phaser, Three.js, Babylon.js).

---

## ⚡ Features

- **Built-in In-Game Dialog:** Pre-styled, responsive confirmation modal with built-in Cancel button and OK authorization flow.
- **Passkey / WebAuthn Native Support:** Provides both dedicated popup (`tab`) and embedded (`iframe`) display modes to navigate Safari ITP and cross-origin WebAuthn restrictions seamlessly.
- **FLIX Ready:** Built on Flow Interaction Templates (FLIX) for secure, human-readable transaction validation.

---

## 📦 Installation

```bash
npm install @blsqui/sdk-web
```
Or using pnpm / yarn:
```bash
pnpm add @blsqui/sdk-web
# or
yarn add @blsqui/sdk-web
```

## 📖 Usage

### 1. Zero-Config Tournament Entry (Default Modal)

By default, @blsqui/sdk-web includes a ready-to-use tournament entry confirmation dialog presets for Testnet (10 FLOW entry):

```bash
import { BlsquiSDK } from '@blsqui/sdk-web';

async function handleEnterTournament() {
  // 組み込み確認モーダルを表示し、オンチェーン確定までポーリングを実行します
  const result = await BlsquiSDK.requestTransaction();

  // トランザクション結果の判定
  if (result.status === 'SEALED') {
    console.log('🎉 大会エントリーが確定しました！ TX ID:', result.txId);
    console.log('プレイヤーアドレス:', result.payer);
    console.log('トランザクション照会用識別番号 (256-bit):', result.nonce);
  } else if (result.status === 'CANCELED') {
    // ユーザーによる確認画面のキャンセルまたは画面クローズ
    console.log('ユーザーにより処理がキャンセルされました。');
  } else {
    // トランザクション実行エラー（残高不足等）またはタイムアウト(FAILED or EXPIRED or TIMEOUT)
    console.warn(`トランザクションが終了しました（ステータス: ${result.status}）:`, result.error || result.errorMessage);
  }
}
```

### 2. Custom FLIX ID, Mainenet setting, Vervose setting and Custome modal use

If your game already provides its own UI (e.g. inventory screen, garage shop, or custom canvas HUD), set `useDefaultModal: false` to bypass the built-in modal and trigger transactions directly:

```bash
import { BlsquiSDK } from '@blsqui/sdk-web';

async function purchaseNitroUpgrade() {
  const result = await BlsquiSDK.requestTransaction({
    useDefaultModal: false,                     // 独自UIを使用します
    isTestnet: false,                           // Mainnetで実行します
    verbose: true,                              // コンソールにログを出力します
    flixId: 'your-registered-flix-template-id', // FLIX IDを指定します。
    args: {
      to: '0x1234567890abcdef'                  // FLIXの引数を指定します
    }
  });

  if (result.status === 'SEALED') {
    applyNitroBoostToVehicle();
  }
}
```

### 3. Display Modes: Popup (tab) vs Embedded (iframe)

Cross-origin Passkeys (WebAuthn) have varying security and storage restrictions across browsers (specifically Safari / iOS WebKit). @blsqui/sdk-web gives you full control over how the signing screen is presented:

```bash
const result = await BlsquiSDK.requestTransaction({
  // Option 1: 'tab' (Default)
  // Opens a centered popup window. Guarantees 100% native Passkey / Face ID / Touch ID
  // compatibility across Safari, iOS, Chrome, and Android.
  displayMode: 'tab', // IFrameではなくポップアップ(デスクトップ環境)/ 別タブ(モバイル環境)で表示します。

  // Option 2: 'iframe'
  // Directly embeds an iframe modal overlay into your game viewport.
  // Ideal for desktop Chromium browsers (Chrome / Brave / Edge).
  // displayMode: 'iframe',
});
```

### 4. Customizing Built-in Modal Texts & Localization

You can customize the emoji icon, header title, description text, and button labels of the built-in confirmation dialog via `modalContent`. This is ideal for internationalization (i18n) or non-tournament purchases (e.g. skin shops, battle passes, or energy refills):

```bash
import { BlsquiSDK } from '@blsqui/sdk-web';

async function handleBuySeasonPass() {
  const result = await BlsquiSDK.requestTransaction({
    useDefaultModal: true,
    isTestnet: true,
    // 組み込みモーダルのテキスト・アイコンを日本語やゲーム内アイテム向けにカスタマイズします
    modalContent: {
      icon: '🎟️',
      title: 'シーズンパス購入',
      leadText: 'シーズン1：サイバーパスをアンロックしますか？',
      subText: '購入費用（5 FLOW）の送金承認が必要です。',
      confirmLabel: '購入する',
      cancelLabel: 'あとで'
    },
    flixId: 'your-registered-flix-template-id',
    args: {
      to: '0xa090f900023d6d34',
      itemId: 'season_pass_s1'
    }
  });

  if (result.status === 'SEALED') {
    console.log('🎉 シーズンパスのアンロックが完了しました！ TX:', result.txId);
  }
}

## ⚙️ Configuration Reference

#### `TransactionOptions`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `isTestnet` | `boolean` | `true` | When `true`, uses Flow Testnet (`lab.blsqui.net`). When `false`, uses Flow Mainnet (`wallet.blsqui.net`). |
| `useDefaultModal` | `boolean` | `true` | Whether to render the built-in in-game confirmation dialog. |
| `displayMode` | `'tab' \| 'iframe'` | `'tab'` | Target container for the signer screen. `'tab'` opens a dedicated popup; `'iframe'` mounts an in-page overlay. |
| `flixId` | `string` | FLIX ID | The FLIX interaction template identifier. |
| `args` | `Record<string, string \| number>` | `undefined` | Key-value pairs forwarded to the signer for custom contract parameters. |
| `verbose` | `boolean` | `false` | When `true`, outputs detailed debug and polling logs to the browser console. |
| `modalContent` | `ModalContentConfig` | `undefined` | Custom titles, leads, labels, and icon emojis for the default dialog. |

#### `ModalContentConfig`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `icon` | `string` | `'🏆'` | Emoji icon or character displayed in the modal header badge. |
| `title` | `string` | `'Tournament Entry'` | Main header text of the dialog. |
| `leadText` | `string` | `'Enter the tournament?'` | Primary lead headline prompting the player. |
| `subText` | `string` | `'Requires 10 FLOW entry fee.'` | Detailed explanation or transaction summary. |
| `confirmLabel` | `string` | `'OK'` | Label for the positive confirmation button. |
| `cancelLabel` | `string` | `'Cancel'` | Label for the dismiss/cancel button. |

#### `TransactionResult`
```bash
interface TransactionResult {
  status: 'SEALED' | 'EXECUTED' | 'FINALIZED' | 'PENDING' | 'EXPIRED' | 'FAILED' | 'TIMEOUT' | 'CANCELED';
  txId?: string;
  nonce: string;
  errorMessage?: string | null;
  error?: string;
  payer?: string;
  to?: string;
  amount?: string;
  token?: string;
}
```

## 📄 License

MIT © Blsqui