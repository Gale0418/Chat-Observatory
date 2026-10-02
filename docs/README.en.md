# Chat Observatory

Make YouTube live chat easier to read on a second screen.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/chat-observatory/fibmebmihidnbhfajjagfnhoncokdnhf) · [繁體中文](../README.md)

## First use

1. Install the extension, open a YouTube live stream or YouTube Studio live-chat page, and keep the page open.
2. Click the Chat Observatory toolbar icon. If the icon is hidden, pin it from Chrome's Extensions menu.
3. Move the standalone chat window to your second screen, expand the control panel, and adjust the text size. Collapse the panel when you are ready to monitor chat.

Each computer needs its own installation and its own copy of the same stream. Chat Observatory does not relay chat or synchronize settings between computers.

## Optional voice reading

Speech is optional. Expand the control panel, choose a voice marked as local by the browser, test it, and then enable reading. The extension reads new messages received while reading is enabled; it does not replay the existing chat or guarantee that every message will be read when chat is busy. Waiting messages can expire or be dropped so the queue does not fall further behind.

Automatic mode tries to match a detectable message language and prefers recognized female voice names. If the language or a matching voice is unavailable, it uses a local fallback. Fixed mode uses the voice you select for every message, which may pronounce other languages poorly. Voice availability and pronunciation depend on the operating system and Chrome profile.

## What you can adjust

- Message, panel, and avatar sizes, plus avatar and badge visibility.
- Twelve local themes, or a JPG, PNG, or WebP background processed and stored in local Chrome extension storage.
- Keyword highlighting and speech cleanup for URLs and repeated text.
- Regular messages, Super Chat, Super Sticker, and membership messages.
- Traditional Chinese, Japanese, or English interface labels. Chat messages remain in their original language.

## Privacy and limits

Chat Observatory does not require an extra account or use an external server. It does not store chat messages. Display and speech settings, plus an optional custom background, stay in local Chrome extension storage. Speech uses only browser voices explicitly marked `localService=true`; if no suitable local voice exists, reading stays disabled. See the [Privacy Policy](../PRIVACY.md) for the complete policy and permission details.

YouTube still needs a network connection. The extension supports desktop Chrome 111 or later and supported YouTube live-chat URLs. It does not translate chat, provide remote moderation, or archive messages. YouTube DOM changes may require selector updates.

## Screenshots

These older fixtures use fictional identities and messages. They are not real user conversations or a complete view of the latest candidate controls.

| Fixture | Example |
| --- | --- |
| [`TEST01 · Ember`](screenshots/test01-ember.png) | Traditional Chinese UI and a Super Chat. |
| [`TEST02 · Aurora`](screenshots/test02-aurora.png) | Japanese and English fixture messages. |
| [`TEST03 · Starlight`](screenshots/test03-starlight.png) | Collapsed controls and a large-text layout. |

## 3.1.0 update (prepared for submission)

The published store version checked on October 2, 2026 is 3.0.1. The 3.1.0 source includes unpublished improvements: a persistent reading switch, separate save and speech retry controls, and female voice preference in automatic mode. The candidate also adds Try random theme and Switch back: try a different look from the expanded panel, then return to the previous theme. A custom background stays in place. The source passes 129 automated tests and synthetic UI checks. Real Chrome injection and audio remain unverified. Version 3.1.0 was uploaded and submitted for Chrome Web Store review on October 2, 2026, with automatic publishing after approval enabled. Review is pending; the public version remains 3.0.1.

## Help

If no local voice is available, add one in your system settings and reopen the chat. Large-text viewing still works without speech. For other problems, [report an issue](https://github.com/Gale0418/Chat-Observatory/issues) with your Chrome and operating-system versions and steps to reproduce. Redact account details and private messages from screenshots.

## Development

Run these commands from the project root. Node.js is required. PowerShell 7 (`pwsh`) is also required by the build and packaging scripts.

```sh
npm ci
npm run verify
npm run build:extension
```

`npm run verify` checks JavaScript syntax and runs the test suite. `npm run build:extension` rebuilds the extension package and checks its source hashes.
