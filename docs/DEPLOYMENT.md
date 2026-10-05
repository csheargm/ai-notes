# Private deployment

AI Notes intentionally binds its API to `127.0.0.1`. Do not port-forward the Mac or expose the development server directly to the public internet.

## Recommended personal setup: Tailscale Serve

Keep the web app, sync API, Ollama/MLX, and trusted Codex/Claude bridge on the Mac. Install Tailscale on each device that should reach the notebook, then proxy the local web port with [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). Serve is tailnet-only and honors tailnet access controls; [Funnel](https://tailscale.com/docs/features/tailscale-funnel) is public and should remain disabled for this app.

Security checklist:

- Use a long, random `AI_NOTES_SYNC_TOKEN`; do not reuse an account password.
- Restrict access to your own user and approved devices with [Tailscale grants](https://tailscale.com/docs/features/access-control/grants).
- Enable [device approval](https://tailscale.com/docs/features/access-control/device-management/device-approval) or, for a more advanced setup, Tailnet Lock.
- Keep Ollama, MLX, Codex, and Claude bound to loopback. Only proxy the AI Notes web entry point.
- Keep agent providers disabled unless needed. Use a dedicated `AI_NOTES_AGENT_WORKSPACE`, review every prompt preview, and never expose agent execution publicly.
- Back up `AI_NOTES_DATA_DIR` and test restoration. The current file store is a personal deployment backend, not a multi-tenant public service.

## Always-on alternative

For access when the Mac is asleep, deploy the static PWA and a hardened sync service to a small cloud host, while leaving local model and CLI execution on the Mac. Connect the cloud service to the Mac through a private tailnet path or an outbound job queue; never make Ollama, MLX, or an agent CLI a public endpoint.

Before making the sync service public, replace the single shared token with per-user OIDC or passkey authentication, add rate limiting and request logging, encrypt backups, rotate secrets, and isolate each user's storage. A protected [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectivity-options/) is another private-ingress option because the connector uses outbound-only connections, but it should be paired with Cloudflare Access rather than a bare public hostname.
