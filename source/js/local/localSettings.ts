import {SplitTunnelingMode, type StoredWebsiteFilterList} from '../vpn/WebsiteFilter';
import type {Logical} from '../vpn/Logical';
import type {UserContext} from '../account/user/UserContext';
import {getBestLogical} from '../vpn/getLogical';
import {isLogicalUp} from '../vpn/getLogicals';
import {Feature} from '../vpn/Feature';

export interface Favorite {
	type: 'country' | 'server';
	id: string;
	label: string;
}
export const maxRules = 1000;
export const maxFavorites = 100;
export const maxBackupBytes = 1024 * 1024;

const object = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Dữ liệu JSON không hợp lệ.');
	}
	return value as Record<string, unknown>;
};

export const normalizeDomain = (value: string): string => {
	const text = value.trim();
	if (!text || /\s/.test(text)) throw new Error('Hãy nhập domain hoặc URL HTTP/HTTPS hợp lệ.');
	const url = new URL(text.includes('://') ? text : `https://${text}`);
	if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
		throw new Error('Chỉ nhận domain/URL HTTP hoặc HTTPS, không kèm mật khẩu hay port.');
	}
	const host = url.hostname.toLowerCase().replace(/\.$/, '');
	if (host.length > 253 || !host.includes('.') || !host.split('.').every(
		label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
	)) throw new Error('Domain không hợp lệ.');
	return host;
};

export const validateRules = (value: unknown): StoredWebsiteFilterList => {
	const data = object(value);
	if (typeof data['enabled'] !== 'boolean' ||
		!Object.values(SplitTunnelingMode).includes(data['mode'] as SplitTunnelingMode) ||
		!Array.isArray(data['value']) || data['value'].length > maxRules) {
		throw new Error('Cấu hình quy tắc không hợp lệ hoặc quá 1000 mục.');
	}
	const rules = data['value'].map((item: unknown) => {
		const rule = object(item);
		if (typeof rule['domain'] !== 'string' || typeof rule['withSubDomains'] !== 'boolean' ||
			!Object.values(SplitTunnelingMode).includes(rule['mode'] as SplitTunnelingMode)) {
			throw new Error('Quy tắc thiếu domain, mode hoặc lựa chọn subdomain.');
		}
		const domain = normalizeDomain(rule['domain']);
		if (domain !== rule['domain']) throw new Error('Trong file JSON, domain phải viết thường và không có URL/path.');
		return {domain, withSubDomains: rule['withSubDomains'], mode: rule['mode'] as SplitTunnelingMode};
	});
	return {enabled: data['enabled'], mode: data['mode'] as SplitTunnelingMode, value: rules};
};

export const validateFavorites = (value: unknown): Favorite[] => {
	if (!Array.isArray(value) || value.length > maxFavorites) throw new Error('Favorites tối đa 100 mục.');
	return value.map((item: unknown) => {
		const favorite = object(item);
		const type = favorite['type'];
		const id = favorite['id'];
		const label = favorite['label'];
		if ((type !== 'country' && type !== 'server') || typeof id !== 'string' ||
			!id || id.length > 200 || (type === 'country' && !/^[A-Z]{2}$/.test(id)) ||
			typeof label !== 'string' || !label.trim() || label.length > 200) {
			throw new Error('Favorite không hợp lệ.');
		}
		return {type, id, label};
	});
};

export const mergeFavorites = (current: Favorite[], incoming: Favorite[]): Favorite[] => {
	const merged = current.slice();
	for (const favorite of incoming) {
		if (!merged.some(item => item.type === favorite.type && item.id === favorite.id)) merged.push(favorite);
	}
	return validateFavorites(merged);
};

export const mergeRules = (current: StoredWebsiteFilterList, incoming: StoredWebsiteFilterList): StoredWebsiteFilterList => {
	const value = current.value.slice();
	for (const rule of incoming.value) {
		if (!value.some(item => item.domain === rule.domain && (item.mode || SplitTunnelingMode.Exclude) === rule.mode)) value.push(rule);
	}
	if (value.length > maxRules) throw new Error('Sau khi gộp vượt quá 1000 quy tắc.');
	return {...current, value};
};

export const addCurrentSite = (current: StoredWebsiteFilterList, url: string): StoredWebsiteFilterList => {
	const domain = normalizeDomain(url);
	const next = mergeRules(current, {enabled: true, mode: SplitTunnelingMode.Include,
		value: [{domain, mode: SplitTunnelingMode.Include, withSubDomains: false}]});
	return {...next, enabled: true, mode: SplitTunnelingMode.Include};
};

export const exportSettings = (rules: StoredWebsiteFilterList, favorites: Favorite[]): string => {
	const normalized = {enabled: rules.enabled ?? false, mode: rules.mode || SplitTunnelingMode.Exclude,
		value: rules.value.map(rule => ({...rule, mode: rule.mode || SplitTunnelingMode.Exclude}))};
	return JSON.stringify({app: 'VPN-Site-Router', version: 1,
		splitTunneling: validateRules(normalized), favorites: validateFavorites(favorites)}, null, 2);
};

export const importSettings = (text: string) => {
	if (new TextEncoder().encode(text).length > maxBackupBytes) throw new Error('File JSON tối đa 1 MiB.');
	const data = object(JSON.parse(text));
	if (data['app'] !== 'VPN-Site-Router' || data['version'] !== 1) throw new Error('Không đúng định dạng backup Site Router v1.');
	return {rules: validateRules(data['splitTunneling']), favorites: validateFavorites(data['favorites'] ?? [])};
};

export const resolveFavorite = (favorite: Favorite, logicals: Logical[], user: UserContext): Logical | undefined => {
	if (favorite.type === 'country') {
		return getBestLogical(logicals.filter(logical => logical.ExitCountry === favorite.id &&
			!(logical.Features & (Feature.SECURE_CORE | Feature.TOR | Feature.RESTRICTED | Feature.PARTNER))), user);
	}
	return logicals.find(logical => `${logical.ID}` === favorite.id && logical.Tier <= user.tier &&
		isLogicalUp(logical, user.country, user.location));
};
