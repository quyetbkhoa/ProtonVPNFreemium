# ProtonVPNCustom

Purpose: a local unofficial Proton browser-extension fork for selected-domain
VPN routing with an existing Free account. Workspace was empty on arrival.
Upstream: https://github.com/ProtonVPN/proton-vpn-browser-extension
Base: 71d7d86f164a2ee8e50ce5a389c9e5cbe0fd6883, version 1.3.6, GPL-3.0.

Workflow: existing upstream main preserved; staged local main/dev/task profile
adopted for this substantive implementation. Work on feat/site-routing-free.
No push, stable promotion, browser profile modification or installation authorized.
Origin is the public upstream source, not a user-owned publishing destination.

Design: reuse upstream authentication and HTTPS proxy, allow local domain split
routing for every tier, preserve actual server entitlements. Keep original public
manifest key/app ID for account callback compatibility; install in isolated Chrome
profile, replacing upstream only within that profile. Clearly label unofficial.
No companion extension: upstream disconnects if another extension takes proxy.

Acceptance: XDA selected routes through VPN, an unrelated download domain routes
direct; account sign-in, restart, reconnect and live IP checks must be observed.
Domain rules do not isolate tabs or bypass downloads on the same selected host.
Upstream service-domain exceptions and privacy behavior remain in scope limits.
