# Current candidate

State: AWAITING_USER
Candidate: 1.3.6-site-router-rc3
Branch: feat/site-routing-free
Prior runtime checkpoint: 927135f (rc2); rc1 checkpoint 7d9eecd.

Implemented: prior routing/location features plus Free Recents (UI and render gate
removed), 30 history choices, country/server Favorites, current-site Include action
and validated JSON backups. Quick-add labels Include switch and keeps old mode
lists. Import previews, then merges without changing current mode/enabled/existing
subdomain flags. JSON exports only allowlisted settings, never credentials; limits
apply before save. Favorites reread storage and recheck availability/tier on use.
One Chrome storage write commits rules and Favorites; updates synchronize editor
and background. Background update failure reports saved-but-not-applied.

Also fixed Free fastest/random actions excluding all Free servers, and replaying
inaccessible/offline server IDs from history. Auto-connect/WebRTC preserve existing
defaults and opt-outs. No Swift/Guest mode or paid-server authorization changes.

Checks: production build, TypeScript and 42 tests passed (12 PAC + 12 location +
18 local settings/history/DOM). Browser availability/storage/tabs mocked; actual
production logic/renderers used. Offline Chrome headless fixtures use actual popup
HTML/CSS: light/dark and 200% text with long labels. Measured no horizontal overflow
or clipped button text; page remains scrollable. Snapshots in logs/ui-rc3, generated
by scripts/preview-local-tools.cjs. Layout QA only, not installed extension QA.

Not run: installed extension sign-in, live proxy/IP/routing, DNS/WebRTC, actual
auto-connect, download speed, restart/reconnect and incognito/runtime permissions.
No user Chrome profile or extension settings changed. Dependencies unchanged;
audit not rerun (rc1 runtime audit zero; full dev/build audit 38 findings).

Packaging: artifacts/rc3/ binary/source ZIPs and CHECKSUMS.json identify the source
snapshot and candidate commit after packaging. Preserve previous artifacts/ and
artifacts/rc2/ files and hashes. distribution/ is the current unpacked build.

Next: user test rc3 with README-CUSTOM-VI.md. Candidate is frozen after local
checkpoint/package. No user acceptance, push, main promotion or deployment yet.
