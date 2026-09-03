# @blsqui/sdk-web

[![npm version](https://img.shields.io/npm/v/@blsqui/sdk-web.svg)](https://www.npmjs.com/package/@blsqui/sdk-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Flow Blockchain](https://img.shields.io/badge/Flow-Blockchain-00EF8B?logo=flow&logoColor=black)](https://flow.com/)

Official Web SDK for **Blsqui** — Enabling Flow blockchain Passkey authentication, FLIX execution, and in-game transaction dialogs for web games and interactive applications.

Designed to mirror the architecture of our native game engine SDKs ([Godot](https://github.com/blsqui/BlsquiSDK-Godot), [Unity](https://github.com/blsqui/BlsquiSDK-Unity), [Unreal Engine](https://github.com/blsqui/BlsquiSDK-UnrealEngine5)), `@blsqui/sdk-web` is a zero-dependency, framework-agnostic TypeScript library that runs smoothly across Svelte, React, Vue, Vanilla JS, and canvas game engines (Pixi.js, Phaser, Three.js, Babylon.js).

---

## ⚡ Features

- **Built-in In-Game Dialog:** Pre-styled, responsive confirmation modal with built-in Cancel bounce and OK authorization flows.
- **Passkey / WebAuthn Native Support:** Provides both dedicated popup (`tab`) and embedded (`iframe`) display modes to navigate Safari ITP and cross-origin WebAuthn restrictions seamlessly.
- **Async Polling Loop:** Mirrors our Godot SDK's `await` architecture. Call `requestTransaction()` and `await` the on-chain `SEALED` block status directly in your game loop.
- **FLIX Ready:** Built on Flow Interaction Templates (FLIX) for secure, human-readable transaction validation.
- **Zero Heavy Dependencies:** Lightweight footprint bundled with ESM, CJS, and complete TypeScript definitions.

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

## 🚀 Quick Start

1. Zero-Config Tournament Entry (Default Modal)

By default, @blsqui/sdk-web includes a ready-to-use tournament entry confirmation dialog presets for Testnet (10 FLOW entry):

```bash
import { BlsquiSDK } from '@blsqui/sdk-web';

async function handleEnterTournament() {
  // Launches built-in dialog and polls until block finalization
  const result = await BlsquiSDK.requestTransaction();

  if (['SEALED', 'EXECUTED', 'FINALIZED', 'SUCCESS'].includes(result.status)) {
    console.log('🎉 Tournament entry confirmed! TX ID:', result.txId);
    console.log('Player Address:', result.payer);
  } else if (result.status === 'CANCELED') {
    console.log('User cancelled the dialog.');
  } else {
    console.warn(`Transaction ended with status: ${result.status}`, result.error);
  }
}
```

2. Custom FLIX & In-Game Items (useDefaultModal: false)

If your game already provides its own UI (e.g. inventory screen, garage shop, or custom canvas HUD), set `useDefaultModal: false` to bypass the built-in modal and trigger transactions directly:

```bash
import { BlsquiSDK } from '@blsqui/sdk-web';

async function purchaseNitroUpgrade() {
  const result = await BlsquiSDK.requestTransaction({
    useDefaultModal: false,
    isTestnet: true,
    flixId: 'your-registered-flix-template-id',
    destination: '0x1234567890abcdef',
    amount: 25.0,
    args: {
      itemId: 'nitro_booster_v2',
      tier: 3
    },
    verbose: true
  });

  if (result.status === 'SEALED') {
    applyNitroBoostToVehicle();
  }
}
```

3. Display Modes: Popup (tab) vs Embedded (iframe)

Cross-origin Passkeys (WebAuthn) have varying security and storage restrictions across browsers (specifically Safari / iOS WebKit). @blsqui/sdk-web gives you full control over how the signing screen is presented:

```bash
const result = await BlsquiSDK.requestTransaction({
  // Option 1: 'tab' (Default)
  // Opens a centered popup window. Guarantees 100% native Passkey / Face ID / Touch ID
  // compatibility across Safari, iOS, Chrome, and Android.
  displayMode: 'tab',

  // Option 2: 'iframe'
  // Directly embeds an iframe modal overlay into your game viewport.
  // Ideal for desktop Chromium browsers (Chrome / Brave / Edge).
  // displayMode: 'iframe',
});
```

## ⚙️ Configuration Reference

`TransactionOptions`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `isTestnet` | `boolean` | `true` | When `true`, uses Flow Testnet (`lab.blsqui.net`). When `false`, uses Flow Mainnet (`wallet.blsqui.net`). |
| `useDefaultModal` | `boolean` | `true` | Whether to render the built-in in-game confirmation dialog. |
| `displayMode` | `'tab' \| 'iframe'` | `'tab'` | Target container for the signer screen. `'tab'` opens a dedicated popup; `'iframe'` mounts an in-page overlay. |
| `flixId` | `string` | FLIX ID | The FLIX interaction template identifier. |
| `args` | `Record<string, string \| number>` | `undefined` | Key-value pairs forwarded to the signer for custom contract parameters. |
| `verbose` | `boolean` | `false` | When `true`, outputs detailed debug and polling logs to the browser console. |
| `modalContent` | `ModalContentConfig` | `undefined` | Custom titles, leads, labels, and icon emojis for the default dialog. |

`TransactionResult`
```bash
interface TransactionResult {
  status: 'SEALED' | 'EXECUTED' | 'FINALIZED' | 'SUCCESS' | 'PENDING' | 'EXPIRED' | 'TIMEOUT' | 'FAILED' | 'CANCELED';
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

## Live Example: Garage Demo
The repository includes a complete Svelte + Vite demo simulating an interactive 2D Cyber Car garage with distance triggers:

```bash
git clone [https://github.com/blsqui/BlsquiSDK-Web.git](https://github.com/blsqui/BlsquiSDK-Web.git)
cd BlsquiSDK-Web

# 1. Build the SDK
npm install
npm run build

# 2. Run the demo
cd examples/web-demo
npm install
npm run dev
```
Open `http://localhost:5173` to test car navigation (< and > controls) and tournament entry triggers.

## 📄 License

MIT © Blsqui