# Current candidate

State: AWAITING_USER
Candidate: 1.3.6-site-router-rc2
Branch: feat/site-routing-free

Implemented: rc1 site routing plus manual country/city/server selection using
upstream full UI (simplifiedUi=false). No Swift code adopted. Paid-only destinations
retain upgrade actions; fix per-city upgrade status in mixed Free/paid country.
Actual account tier and server authorization are unchanged. Prior rc1 checkpoint:
7d9eecd, with its existing ZIPs and hashes preserved under artifacts/.

Evidence: production npm run build passed; npx tsc --noEmit passed; 12 site-routing
tests passed; 10 location-picker
DOM/selection tests passed with synthetic inventory (browser availability and
translations stubbed, real renderers/config/selection/filter logic). Regression
confirmed then fixed: paid city wrongly enabled when a sibling city has Free
servers. Runtime dependency audit was zero on rc1; dependencies are unchanged.
The rc1 full dependency audit had 38 dev/build findings; audit not rerun for rc2.
Browser login, proxy routing/IP, download speed, DNS/WebRTC, restart, reconnect,
offline/failure states: NOT RUN. No profile/device/account settings changed.

Packaging: npm run build then npm run package:custom checks manifest references, extension callback ID,
bundled JavaScript syntax and license/notice; binary/source ZIP hashes and a full
source file hash inventory in artifacts/rc2 identify the exact candidate. See
artifacts/rc2/CHECKSUMS.json and artifacts/rc2/SOURCE-FILES-SHA256.json.

Git checkpoint: user explicitly supplied quyetbkhoa <quyetbkhoa@gmail.com> and
authorized global Git identity configuration. Save rc2 on feat/site-routing-free;
no stable promotion or remote push authorized.

Next: user test using README-CUSTOM-VI.md in a separate Chrome profile. Freeze rc2;
do not promote main or push origin. Any material fix creates a new candidate and
requires recheck. No user acceptance or live browser pass has occurred.
