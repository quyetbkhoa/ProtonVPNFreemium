import {getDomainFilterList} from './getDomainFilterList';
import type {
	StoredWebsiteFilterList,
	SplitTunnelingMode,
} from './WebsiteFilter';
import {defaultSplitTunnelingMode} from './SplitTunnelingDomainManager';

export interface SplitTunnelingConfig {
	mode: SplitTunnelingMode;
	filteredDomains: string[];
}

export const getSplitTunnelingConfig = (
	_userTier: number,
	splitTunneling: StoredWebsiteFilterList,
): SplitTunnelingConfig =>
	// Domain routing is local in this custom build. Server entitlements stay unchanged.
	splitTunneling.enabled !== false
		? {
				mode: splitTunneling.mode || defaultSplitTunnelingMode,
				filteredDomains: getDomainFilterList(
					splitTunneling.value.filter(
						(domain) =>
							(domain.mode || defaultSplitTunnelingMode) ===
							(splitTunneling.mode || defaultSplitTunnelingMode),
					),
				),
			}
		: {
				mode: defaultSplitTunnelingMode,
				filteredDomains: [],
			};
