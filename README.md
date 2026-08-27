# Houdry Agent

**Private agentic desktop for organizations running [Houdry](https://github.com/houdry-genomex/houdry).**

Houdry Agent is the end-user application: chat, tools, files, and local agent
workflows. GPU servers run the **Houdry fabric** (`houdry serve` +
`houdry node join`); this app talks to that fabric over the OpenAI-compatible
API (`POST /v1/chat/completions`).

## Built on Hermes Agent

This project is a fork of **[Hermes Agent](https://github.com/NousResearch/hermes-agent)**
by [Nous Research](https://nousresearch.com) (MIT License).

- Upstream: https://github.com/NousResearch/hermes-agent  
- Docs / Desktop: https://hermes-agent.nousresearch.com  
- Attribution: see [NOTICE](NOTICE) and [UPSTREAM.md](UPSTREAM.md)

Hermes is open source and can be used by anyone. Houdry Agent redistributes and
rebrands it for the Houdry product split (fabric for servers, agent for users).

## Who installs what

| Role | Install |
|------|---------|
| GPU / ops | [houdry](https://github.com/houdry-genomex/houdry) — `serve`, `node join`, models |
| Normal user | **Houdry Agent** (this repo) — Desktop app → fabric URL |

## Quick start (with a local fabric)

**1. Fabric (GPU machine)**

```bash
curl -fsSL https://github.com/houdry-genomex/houdry/releases/latest/download/install.sh | sh
export PATH="$HOME/.houdry/bin:$PATH"
houdry serve --listen 0.0.0.0:18080
# other terminal:
houdry node join --server http://127.0.0.1:18080
```

**2. Agent defaults**

On first configure, point the model provider at Houdry:

```yaml
# ~/.houdry-agent/config.yaml  (created under HERMES_HOME-compatible layout)
model:
  provider: custom
  base_url: http://127.0.0.1:18080/v1
  default: auto
```

```bash
# ~/.houdry-agent/.env
OPENAI_API_KEY=houdry
```

Or copy [config/houdry-fabric.defaults.yaml](config/houdry-fabric.defaults.yaml).

**3. Desktop**

```bash
cd apps/desktop
npm install   # from repo root install instructions as upstream
npm run dev   # development
# Packaging: npm run dist / dist:linux / dist:mac / dist:win
```

See [docs/HOUDRY.md](docs/HOUDRY.md) for fabric wiring, data directories, and release notes.

## License

MIT — see [LICENSE](LICENSE) (Copyright Nous Research for upstream Hermes code;
Houdry modifications also MIT).
