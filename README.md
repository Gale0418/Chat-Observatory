# Chat Observatory 🌌

Chat Observatory is a local-first Chrome extension for turning a YouTube live-chat page into a comfortable, readable second-screen monitor. Big messages, themeable space visuals, multilingual UI labels, and optional local text-to-speech—packed into one friendly little observatory (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧

> **Synthetic demo notice:** The screenshots in [`docs/screenshots/`](docs/screenshots/) use fictional `TEST01`, `TEST02`, and `TEST03` identities and invented multilingual messages. They are test fixtures, not real user conversations.

## What it does

- Opens a standalone live-chat window from a YouTube watch page or YouTube Studio.
- Makes authors, avatars, and messages easier to read from a distance.
- Provides twelve local cosmic themes with responsive colors, contrast outlines, and bundled backgrounds.
- Offers separate message and control-panel sizing, avatar and badge visibility controls, keyword highlighting, and a collapsible control center.
- Supports Traditional Chinese, Japanese, and English interface labels. Chat messages are never translated.
- Optionally reads new messages with the browser's explicitly local `SpeechSynthesis` voices.
- Cleans URLs, repeated text, and configurable prefixes before speech to keep the queue comfortable.
- Handles regular messages, Super Chat, Super Sticker, and membership messages.

## Chrome Web Store data-use disclosure

This extension has one purpose: improve the readability of YouTube live chat on a second screen and, when enabled, read new messages aloud using voices already installed on the local device.

### Data handling

- **Data collected:** None. Chat Observatory does not collect account data, browsing history, analytics, advertising identifiers, or chat transcripts.
- **Data transmitted:** None. Chat text and settings stay in the browser on the current device; there is no remote relay or cloud processing.
- **Data sold or shared:** Nothing is sold, rented, or shared with third parties.
- **Data storage:** Display and speech preferences are saved in Chrome extension storage. Chat messages are not stored by the extension.
- **Speech:** Text-to-speech uses the browser's `SpeechSynthesis` API and only voices explicitly marked `localService=true`. If no suitable local voice exists, speech stays disabled rather than falling back to an unverified online voice.

### Permissions and why they are needed

- `activeTab` — after the user clicks the toolbar button, reads the current YouTube URL to find the live-chat context and open the standalone chat window.
- `storage` — saves local display, theme, language, and speech preferences so the observatory feels consistent across chat windows.
- YouTube live-chat content access — applies readable styling and observes new messages on supported `https://www.youtube.com/live_chat*` pages.

Chat Observatory does not require an account, does not use an external server, and is not affiliated with or endorsed by YouTube or Google.

## Synthetic screenshot gallery

These images are deterministic UI fixtures made for documentation. Every identity and message is fictional, and each image uses a different theme or layout state.

| Fixture | What it demonstrates |
| --- | --- |
| [`TEST01 · Ember`](docs/screenshots/test01-ember.png) | Traditional Chinese UI, red super-chat styling, and readable long-form messages. |
| [`TEST02 · Aurora`](docs/screenshots/test02-aurora.png) | Japanese and English synthetic messages with the cool black-hole theme. |
| [`TEST03 · Starlight`](docs/screenshots/test03-starlight.png) | Collapsed control center and a multilingual test queue with bright gold accents. |

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open a YouTube live stream or YouTube Studio live-chat page.
5. Click the Chat Observatory toolbar icon, then tune the theme, text size, and local voice settings.

## Limitations

- This is a Chrome extension for supported YouTube live-chat URLs; YouTube DOM changes may require selector updates.
- Interface labels can switch languages, but chat content remains in its original language.
- Available local voices depend on the operating system and Chrome profile.
- The extension does not provide translation, remote moderation, cloud speech, or a chat archive.

## Development verification

```powershell
npm ci
npm run verify
npm run build:extension
```

`npm run verify` performs JavaScript syntax checks and the automated test suite. `npm run build:extension` rebuilds `dist/chat-observatory/` and `dist/chat-observatory.zip`, checks source hashes, and packages only the extension runtime files and bundled theme assets.

## Project layout

- `content.js` / `content.css` — live-chat behavior and themeable UI.
- `background.js` — validated URL handling and standalone chat-window lifecycle.
- `_locales/` — English, Japanese, and Traditional Chinese extension messages.
- `assets/themes/` — local cosmic background materials.
- `docs/screenshots/` — synthetic, non-user documentation screenshots.
- `tests/` — background, content, and visual fixture tests.
- `scripts/` — icon, screenshot, and extension-package tooling.

Have fun exploring the chat cosmos—and keep the test data fictional, please! (ง •̀_•́)ง
