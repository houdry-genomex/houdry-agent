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

On first run, pick **Houdry server URL** (recommended) and keep
`http://127.0.0.1:18080/v1` (or your LAN/Tailscale fabric host). Optional API
key: `houdry`. Or seed config without the UI:

```bash
./scripts/seed-houdry-fabric-config.sh
```

Equivalent YAML:

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
# Packaging (GitHub Releases on this repo):
#   npm run dist:linux | dist:mac | dist:win
```

See [docs/HOUDRY.md](docs/HOUDRY.md) for fabric wiring, data directories, and release notes.

Azure OpenAI (dev GPT deployments) ↔ Houdry switch: [docs/AZURE_OPENAI.md](docs/AZURE_OPENAI.md).

## MRPL layer (on top of Hermes)

MRPL workflows are **skills + knowledge + governance**, not a core rewrite.
Inference stays swappable (Azure for development, Houdry for private GPU).

- Architecture: [docs/mrpl/ARCHITECTURE.md](docs/mrpl/ARCHITECTURE.md)
- Run / switch providers: [docs/mrpl/RUNNING.md](docs/mrpl/RUNNING.md)
- Skills: `skills/mrpl/`
- Knowledge mount scaffold: `knowledge/mrpl/`

## License

MIT — see [LICENSE](LICENSE) (Copyright Nous Research for upstream Hermes code;
Houdry modifications also MIT).
