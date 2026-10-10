# Milestone 0: q5m-math on an upstream Paseo 0.11.2 host

Evidence gathered on 2026-10-10. This gates the feature work in Tasks 3-9.

## Setup

| Item | Value |
| --- | --- |
| Host | `getpaseo/paseo` `7868f5caf6515543a81ffc58fe941e15e917dcf9` (0.11.2), detached worktree `/home/joe/code/zge-workspace/worktrees/paseo/upstream-host` |
| Dev daemon | `127.0.0.1:6768`, `PASEO_HOME=/home/joe/code/zge-workspace/worktrees/paseo/upstream-host/.dev/paseo-home`, server id `srv_Z98dM6DGlpRu` |
| Plugin | this branch at `6647edf`, installed with `npm run cli -- plugin install /home/joe/code/zge-workspace/worktrees/paseo-math/upstream-0-11`; `plugin ls` shows `q5m-math running` |
| Web client | `scripts/dev-app.sh` with `EXPO_PORT=8090` (port 8081 is taken on this machine) |
| Electron | `npm run dev:desktop` under `xvfb-run`, driven over CDP (`PASEO_ELECTRON_REMOTE_DEBUGGING_PORT=9333`) |
| Browser | Playwright 1.58.2, `chromium-headless-shell` 1208, viewport 1400x1000 |
| Agent | Claude `claude-sonnet-5-5` on the dev daemon |

Upstream installs plugins disabled until the root config field `pluginsEnabled` is `true`
(upstream `docs/plugins.md`). It was set in the dev home's `config.json` only, then applied with
`npm run cli -- reload`.

For deterministic messages each prompt asks the agent to echo exact markdown verbatim. The prompts
are in `docs/milestone-0/prompts/`.

The web client is the Expo development bundle (React dev mode). Absolute timings are therefore
pessimistic compared with a production build. Plugin-on versus plugin-off comparisons use the same
bundle.

## Step 2: basics on web

Prompt: `docs/milestone-0/prompts/step2-basics.txt` (heading, paragraph with `$a^2+b^2=c^2$`, a
display integral, a `ts` fence, a table).

- Formulas render. Inline and display math are daemon-rendered PNG `<img>` elements whose `alt` is
  the TeX source. The whole reply is one plugin row,
  `data-message-id="q5m-math/<message id>/0"`.
- The heading, code fence, and table render. The `ts` fence has no syntax highlighting. Task 4 is the
  place to address that.
- The message streams in. A screenshot taken mid-stream shows a cut-off code line
  (`... => Math`) while the stop button is visible. The 50-formula run below has 95-113 distinct
  intermediate states.

![Rendered](milestone-0/step2-web-rendered.png)

![Mid-stream](milestone-0/step2-web-streaming.png)

## Step 3: renderer throw

With `if (text.includes("THROW_TEST")) throw new Error("test");` temporarily added after
`const { text } = item.data;` in `MathMessageView` (`client/math-message.tsx`), the plugin was
rebuilt and reloaded. The agent then replied with `docs/milestone-0/prompts/step3-throw.txt`:
"Line before the test." / "THROW_TEST $x$" / "Line after the test.".

**Finding: the host shows an error card.** The row contains only red text `Plugin failed: test`. It
is neither empty nor source text. The whole message is hidden, including the two plain lines. Other
rows render normally. The card comes from the host's `SurfaceErrorBoundary`
(`packages/app/src/plugins/timeline/view.tsx:83`, no `renderError`, `resetKey={item.data}`), so a
new streamed update resets it.

The brief's literal condition ("if the row is empty") does not apply. However, the card does not
meet the global constraint "Every failure degrades to raw source for the affected part only". The
Task 3 error boundary that renders `<Text selectable>{text}</Text>` is still needed to meet that
constraint.

The line was then removed, and the plugin was rebuilt and reloaded. The same row then rendered
"Line before the test. / THROW_TEST x / Line after the test." `git status` showed no change to
`client/math-message.tsx`.

![Error card](milestone-0/step3-web-renderer-throw.png)

![After revert](milestone-0/step3-web-after-revert.png)

## Step 4: selection-copy spike

The brief's two listeners were installed with `page.evaluate`. Two probes were added: a bubbling
listener on the plugin row element, and a bubbling listener on `window`. The `window` listener runs
after React's root-container listener, which is where the host's `onCopy` runs. Text was selected
with a real mouse drag, from "A right triangle" across the inline formulas to "hypotenuse". The
copy was a real `Control+C`, with clipboard permissions granted.

Plugin row (`q5m-math/msg_011Cfttm86NqatWyAA6n3mQx/0`), in listener order:

```
document copy false
message row copy (bubble) false
row copy (bubble) false
window copy (bubble, after React root) false clipboardData text/plain="" types=[]
```

Clipboard `text/plain`: `"A right triangle satisfies \n for legs \n, \n and hypotenuse \n"`.
The formulas are missing: the browser's default copy drops the `<img>` alt text. The `text/html`
part is RN-web spans with inline styles.

Control: a host-rendered assistant row ("OK"), triple-clicked and copied:

```
document copy false
message row copy (bubble) false
row copy (bubble) false
window copy (bubble, after React root) true clipboardData text/plain="OK" types=["text/plain","text/html"]
```

So the host's handler (`AssistantSelectionCopySurface`, a React `onCopy` on a wrapper `div`) runs
after every native bubbling listener inside the chat. It calls `preventDefault()` only when the
selection starts and ends inside `[data-testid="assistant-message"]` (`createAssistantSelectionClipboardContent`
returns `null` otherwise). For a selection inside a plugin row it does not prevent default.

**Decision for Task 7: branch 1.** The host's handler does not prevent default for selections inside
a plugin row, and it runs after the row's bubbling listener. The plugin handles `copy` on its own row
element in the bubble phase and calls `preventDefault()` and `stopPropagation()`. The capture-phase
document listener branch is not needed.

Electron loads the same `surface.web.tsx` (there is no `.electron` variant), so the same order
applies there. The spike was run on web only.

![Selection](milestone-0/step4-web-plugin-selection.png)

## Step 5: 50-formula message

Prompt: `docs/milestone-0/prompts/step5-50-formulas.txt` (50 numbered physics equations, each a
bold title, a `$$` display equation, and one sentence; 4018 rendered characters, 50 formula images).

Definitions:

- **Streaming**: from send to the last formula image decoded. Sampled every 100 ms in the page.
- **Long tasks**: `PerformanceObserver` `longtask` entries (>= 50 ms).
- **Keystroke latency**: Event Timing `duration` for keys typed into the composer once per 1.5 s
  while the reply streams.
- **Open**: from clicking the workspace in the sidebar to all 50 images decoded.
- **Scroll**: 40 wheel steps of 150 px up and 40 down, frame gaps from `requestAnimationFrame`.

### Streaming

| Run | First row | All 50 images decoded | Long tasks (count / max / total) | Keystroke latency max |
| --- | --- | --- | --- | --- |
| Web, plugin on | 2.5 s | 15.2 s (stream end + <0.1 s) | 20 / 70 ms / 1.15 s | 80 ms |
| Web, plugin off (host Markdown) | 2.5 s | n/a | 3 / 88 ms / 0.21 s | 48 ms |
| Electron, plugin on | 2.6 s | 15.9 s (stream end + <0.1 s) | 5 / 99 ms / 0.36 s | 32 ms |
| Web, 4x CPU throttle, plugin on | 2.9 s | 17.1 s | 77 / 363 ms / 12.2 s | 280 ms |
| Web, 4x CPU throttle, plugin off | 3.3 s | n/a | 108 / 408 ms / 13.0 s | 168 ms |

A second plugin-on web run without the typing probe gave 18 long tasks, max 65 ms. A run with a
Chromium trace recording showed a 434 ms task, which was a minor GC inflated by tracing. The
untraced numbers above are the ones to use.

Formula images keep up with the stream: the last image decodes within one 100 ms sample of the last
text change. Incomplete display math shows as source (`$$\vec L = \v`) until its closing `$$`
arrives. See the streaming screenshot.

### Open and scroll (one agent, one 50-formula reply)

| Run | Open to fully rendered | Long tasks during open | Scroll frames >50 ms | Max frame gap |
| --- | --- | --- | --- | --- |
| Web, plugin on | 984 ms | 2, max 206 ms | 0 of 210 | 17 ms |
| Web, plugin off | 890 ms | 2, max 515 ms | 0 of 211 | 17 ms |
| Electron, plugin on | 870 ms | 2, max 177 ms | 0 of 210 | 17 ms |
| Web, 4x throttle, plugin on | 3630 ms | 9, max 919 ms | 0 of 225 | 33 ms |
| Web, 4x throttle, plugin off | 4032 ms | 8, max 2564 ms | 1 of 245 | 67 ms |

**Verdict: no visible input or scroll lag on web or Electron.** Scrolling holds 60 fps. During
streaming, keystrokes paint within 80 ms on web and 32 ms on Electron. Compared with host-only
Markdown, the plugin adds about 1 s of main-thread work over a 15 s stream at native speed.

Under a 4x CPU throttle (dev bundle), the whole streaming path saturates the main thread whether
the plugin is on or off. The per-update cost grows with message length: tasks grow from about
100 ms to about 300 ms as the reply nears 50 formulas. That is a phone-class risk, and only Joe's
device pass can settle it.

![Web mid-stream](milestone-0/step5-web-streaming.png)

![Web rendered](milestone-0/step5-web-rendered.png)

![Web scrolled to top of reply](milestone-0/step5-web-scrolled.png)

![Electron mid-stream](milestone-0/step5-electron-streaming.png)

![Electron rendered](milestone-0/step5-electron-rendered.png)

## Joe's device pass (pending)

iOS and Android were not checked. Joe runs these against the same dev daemon.

### Connect a phone to the dev daemon

Use a phone app on Paseo 0.11.x to match the 0.11.2 daemon; other app versions were not tested
against this plugin. Relay is enabled on the dev daemon. Run this on the laptop:

```bash
cd /home/joe/code/zge-workspace/worktrees/paseo/upstream-host
env -u PASEO_HOME npm run cli -- daemon pair --home /home/joe/code/zge-workspace/worktrees/paseo/upstream-host/.dev/paseo-home
```

`env -u PASEO_HOME` and `--home` matter. A terminal opened inside Paseo inherits
`PASEO_HOME=~/.paseo`, which would pair the production daemon on 6767 instead. The command prints
a QR code and an `https://app.paseo.sh/#...` link. In the phone app, scan the QR code, or choose
**Paste pairing link**. The host appears with server id `srv_Z98dM6DGlpRu`.

Workspaces already on the dev daemon:

| Workspace | Agent | Contents |
| --- | --- | --- |
| `m0-agents` | `m0-step2-basics` | Step 2 replies, the `THROW_TEST` row (now renders normally) |
| `m0-agents5` | `m0-step5-perf` | Several 50-formula replies; use for streaming |
| `m0-agents6` | `m0-step5-cold` | Exactly one 50-formula reply; use for open and scroll |

To stream a fresh 50-formula reply, send "Repeat your previous reply exactly." to `m0-step5-perf`
from the phone. You can also send the prompt file from the laptop:
`env -u PASEO_HOME npm run cli -- send <agent id> --prompt-file /home/joe/code/zge-workspace/worktrees/paseo-math/upstream-0-11/docs/milestone-0/prompts/step5-50-formulas.txt`.

### Check on iOS and on Android

1. Step 2: in `m0-agents`, inline and display formulas render as images, and the heading, code
   fence, and table render. Send the Step 2 prompt again and watch it stream in.
2. Step 3 outcome on native: the host error card is `Plugin failed: <message>` on web. Native uses
   the same boundary (`plugins/timeline/view.tsx` has no platform variant). No re-test is needed unless the plugin changes. Confirm that the
   `THROW_TEST` row in `m0-agents` shows "Line before the test. / THROW_TEST x / Line after the
   test.".
3. Step 5: open `m0-agents6` and note the time until all 50 formulas show. Scroll the reply top to
   bottom quickly. Then, in `m0-agents5`, send the repeat prompt, type in the composer while it
   streams, and scroll during the stream.
4. Record whether input or scroll lag is visible. Visible lag blocks rollout. Compare it to a
   host-only message of similar length if unsure: disable with
   `env -u PASEO_HOME npm run cli -- plugin disable q5m-math` and re-enable with `plugin enable`,
   run from the host checkout.

Record the results here under "Device results".

### Device results

2026-10-10, Joe: iOS and Android pass — formulas render and stream; no visible input or scroll lag.
