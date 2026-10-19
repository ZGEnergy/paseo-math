# Paseo Math

Markdown and LaTeX rendering for assistant messages that contain math in [Paseo](https://github.com/getpaseo/paseo), as a plugin.

This is an independently maintained fork of [q5m-ai/paseo-math](https://github.com/q5m-ai/paseo-math), kept current with upstream Paseo 0.11 and tracking [getpaseo/paseo](https://github.com/getpaseo/paseo) only. It builds on work by q5m-ai and ekalvi; see [NOTICE](NOTICE) for attribution and licenses.

## Features

A message is rendered by this plugin only when it contains math; every other message stays with the host.

- **Math:** inline `\(...\)` and `$...$`, display `\[...\]` and `$$...$$`, rendered to images by the host daemon. A formula that is invalid or too large falls back to its source text.
- **Streaming:** text reveals at the host's pace while the message streams.
- **Syntax highlighting:** fenced code is highlighted with Paseo's highlighter, using light and dark palettes that follow the app theme.
- **Links and file paths:** web and mailto links open after a press. Workspace file links and file-looking inline code are styled with the theme accent; pressing them does nothing, because plugins cannot open workspace files.
- **Images:** workspace images in `![alt](path)` render at their natural size, up to the width of the message.
- **Web copy:** on web and desktop, selecting text that includes a formula and copying yields Markdown with the TeX source. Selections with no formula copy as usual.
- **Copy source:** the upper-right copy icon copies the original Markdown and TeX.

## Compatibility

**Requires Paseo 0.11+ on both the host daemon and the client app.** Build, typecheck, and compiler smoke validation use the SDK from the Paseo `v0.12.0` release (`getpaseo/paseo@cafe4b01c8`).

Validated on Paseo 0.11.2 in a browser and in the Electron dev app on Linux. iOS and Android passes are tracked in [docs/validation.md](docs/validation.md), along with the failures found so far. Automated tests are not a substitute for testing those clients.

Upgrading a host does not upgrade its Android, desktop, or other client apps. A client older than 0.11, such as Paseo `0.7.2`, cannot load the current plugin and can report:

```text
Module "@getpaseo/plugin/client/react-native" is not available in plugin client code
```

Update the client to the matching 0.11 release rather than installing the plugin again. Official clients are available from the [Paseo releases page](https://github.com/getpaseo/paseo/releases).

## Staying current

A weekly sync checks [getpaseo/paseo releases](https://github.com/getpaseo/paseo/releases) and opens a pull request here when something changed. The prompt it runs is [docs/sync-schedule.md](docs/sync-schedule.md).

- It tracks stable release tags, not `main`. `npm run drift` reports new releases, host rendering changes, plugin SDK changes, relevant release notes, and unreleased changes on `main` as an early warning.
- Every new release is re-pinned and run through the full build, test, and smoke gate, even when nothing math-related changed. A break opens a draft pull request.
- When Paseo adds host APIs that improve math rendering, the sync adopts them. It raises the plugin's minimum Paseo version only up to the version the maintainer's production daemon runs, never beyond. Changes that need a newer Paseo are listed in the pull request as waiting.
- The sync merges its own pull request only when it is not a draft, every local gate passed, CI is green, and GitHub reports it mergeable. Anything else stays open as a draft with the reason in a comment.

## Install

Plugins are trusted code: they execute on the host and inside the client app without sandboxing. Install only code you trust.

You need Git, Node.js **22.22 or newer**, npm, and the **Paseo 0.11 CLI** on the host, with its Paseo daemon running.

1. In the app, select the host where your agent runs, open **Settings → Plugins**, and turn on **Enable plugins**.
2. In a terminal on that host, run:

   ```sh
   paseo plugin install https://github.com/ZGEnergy/paseo-math.git --ref main
   paseo plugin ls
   ```

   Use your usual authenticated Paseo connection if the host requires a password. Paseo clones the latest commit on `main` and runs its dependency installation and build automatically—no manual clone, build, or directory entry is needed.
3. Confirm `q5m-math` is **running**, then ask an agent on that host for a math response.

Install once per host, not per agent or phone. If `q5m-math` is already installed and enabled, skip installation. After updating the client app, reconnect and use **Reload** on the plugin if needed.

### Updates and pinned releases

An install from `main` uses the latest code on ZGEnergy/paseo-math `main`, not a fixed release. To fetch and install newer commits later, run:

```sh
paseo plugin update q5m-math
paseo plugin ls
```

**Reload** alone does not fetch newer commits. The update command follows the Git ref selected at installation; an existing tagged install does not switch to `main` automatically.

For a reproducible install, replace `main` in the install command with an exact tag or commit of this repository, and check its compatibility notes. To switch an existing install between a tag and `main`, remove its registration with `paseo plugin remove q5m-math`, then run the install command with the desired `--ref`.

## Writing math

Use `\(...\)` or `$...$` for inline math and `\[...\]` or `$$...$$` for display math. Ask the agent to return Markdown with LaTeX, **without wrapping its response in a code fence**; code remains literal.

For example, ask:

> Show the Pythagorean theorem as a display equation using LaTeX delimiters. Do not put the response in a code fence.

Expected response source:

```markdown
### Pythagorean theorem

$$
a^2 + b^2 = c^2
$$
```

The examples below use display-math blocks that also render on GitHub. Open the README's source to copy their Markdown and LaTeX directly.

## Mathematics

### Pythagorean theorem

$$
a^2 + b^2 = c^2
$$

### Fundamental theorem of calculus

$$
\int_a^b f'(x)\,dx = f(b) - f(a)
$$

### Euler's identity

$$
e^{i\pi} + 1 = 0
$$

## Physics

### Newton's second law

$$
\mathbf{F}_{\mathrm{net}} = ma
$$

### Newton's universal gravitation

$$
F = G\frac{m_1 m_2}{r^2}
$$

### Maxwell's equations

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0\mathbf{J} + \mu_0\varepsilon_0\frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

### Einstein's mass–energy equivalence

$$
E_0 = mc^2
$$

### Einstein's field equations

$$
G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4}T_{\mu\nu}
$$

### Schrödinger's equation

$$
i\hbar\frac{\partial}{\partial t}\Psi = \hat{H}\Psi
$$

## Copying and rendering limits

- The upper-right copy icon (**Copy source** for screen readers) copies the original source supplied to that plugin item. Paseo can split a response into native Markdown blocks, so this is not a guarantee of copying the entire assistant turn; multiple copy actions can appear in one response.
- Invalid or oversized formulas fall back to source rather than replacing the response with a rendering error.
- Plugin startup on a host does not prove that every connected client can render it. Check the client version and the plugin's status in that client when diagnosing missing math.
