# Current candidate

State: AWAITING_USER
Candidate: 1.3.6-site-router-rc1
Branch: feat/site-routing-free

Implemented: Free-tier local split routing; new profiles default to Include mode;
unofficial identity label; regression suite; Vietnamese install/rollback guide;
packager with callback-ID, manifest/resource and bundled JavaScript syntax checks.
Upstream actual account tier and server authorization are unchanged.

Evidence: npm ci --ignore-scripts completed; npm run build passed; npx tsc --noEmit
passed; 12 routing regressions passed (real production PAC evaluated in Node VM,
browser lifecycle imports stubbed). Runtime dependency audit reports zero findings;
full upstream dependency tree reports 38 findings, including dev/build tooling.
Browser login, proxy routing/IP, download speed, DNS/WebRTC, restart, reconnect,
offline/failure states: NOT RUN. No profile/device/account settings changed.

Packaging: npm run package:custom checks manifest references, extension callback ID,
bundled JavaScript syntax and license/notice; binary/source ZIP hashes and a full
source file hash inventory in artifacts identify the exact candidate. See
artifacts/CHECKSUMS.json and artifacts/SOURCE-FILES-SHA256.json.

Git checkpoint: user explicitly supplied quyetbkhoa <quyetbkhoa@gmail.com> and
authorized global Git identity configuration. Save rc1 on feat/site-routing-free;
no stable promotion or remote push authorized. Existing artifact hashes describe
the packaged pre-checkpoint snapshot; this note-only update does not change runtime.

Next: user test using README-CUSTOM-VI.md in a separate Chrome profile. Freeze rc1;
do not promote main or push origin. Any material fix creates a new candidate and
requires recheck. No user acceptance or live browser pass has occurred.
