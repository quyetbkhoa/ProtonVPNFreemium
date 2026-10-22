import {getCurrentTab} from '../tools/getCurrentTab';
import {storage} from '../tools/storage';
import {escapeHtml} from '../tools/escapeHtml';
import {getCountryNameOrCode} from '../tools/translate';
import type {Logical} from '../vpn/Logical';
import type {UserContext} from '../account/user/UserContext';
import type {ServerSummary} from '../vpn/ConnectionState';
import {SplitTunnelingMode, type StoredWebsiteFilterList} from '../vpn/WebsiteFilter';
import {addCurrentSite, exportSettings, importSettings, maxBackupBytes,
	mergeFavorites, mergeRules, normalizeDomain, resolveFavorite, validateFavorites,
	type Favorite} from '../local/localSettings';

export const favoriteStore = storage.item<{value: Favorite[]}>('site-router-favorites');

interface Options {
	user: UserContext;
	getLogicals(): Logical[];
	getServer(): ServerSummary | undefined;
	getRules(): Promise<StoredWebsiteFilterList>;
	isControllable(): boolean;
	save(rules?: StoredWebsiteFilterList, favorites?: Favorite[]): Promise<void>;
	connect(logical: Logical): Promise<void>;
}

export const configureLocalTools = (area: HTMLElement, options: Options) => {
	const previous = area.querySelector<HTMLElement>('#site-router-tools');
	if (!previous) return {refresh() { /* absent in non-popup views */ }};
	const root = previous.cloneNode(false) as HTMLElement;
	previous.replaceWith(root); // Discard old listeners if the popup view is initialized again.
	root.innerHTML = `
		<button type="button" class="primary-button" data-local-action="add-site" disabled>Dùng VPN cho site này</button>
		<p class="local-site-description"></p>
		<p class="local-status" role="status" aria-live="polite"></p>
		<details><summary>Favorites và sao lưu quy tắc</summary>
			<label for="favorite-country">Quốc gia yêu thích</label>
			<select id="favorite-country"></select>
			<div class="local-actions">
				<button type="button" data-local-action="add-country" disabled>Lưu quốc gia</button>
				<button type="button" data-local-action="add-server" disabled>Lưu máy chủ đang dùng</button>
			</div>
			<div class="local-favorites"></div>
			<div class="local-actions">
				<button type="button" data-local-action="export">Xuất JSON</button>
				<label class="local-file-label">Chọn file JSON
					<input type="file" class="local-import-file" accept=".json,application/json">
				</label>
			</div>
			<p class="local-import-preview"></p>
			<button type="button" data-local-action="import" disabled>Nhập và gộp quy tắc</button>
			<p>Nhập giữ nguyên Include/Exclude và trạng thái bật/tắt hiện tại. File không chứa tài khoản hoặc token. Lịch sử gần đây lưu tối đa 30 mục.</p>
		</details>`;
	const status = root.querySelector<HTMLElement>('.local-status')!;
	const country = root.querySelector<HTMLSelectElement>('#favorite-country')!;
	const input = root.querySelector<HTMLInputElement>('.local-import-file')!;
	let favorites: Favorite[] = [];
	let pending: ReturnType<typeof importSettings> | undefined;
	let busy = false;
	let siteUrl: string | undefined;
	let siteDomain: string | undefined;
	let displayedMode: SplitTunnelingMode | undefined;
	const say = (text: string) => { status.textContent = text; };

	const render = async () => {
		favorites = validateFavorites((await favoriteStore.get())?.value || []);
		const logicals = options.getLogicals();
		const previousCountry = country.value;
		const codes = [...new Set(logicals.map(item => item.ExitCountry))].sort();
		const available = codes.filter(code => resolveFavorite({type: 'country', id: code, label: code}, logicals, options.user));
		country.innerHTML = available.map(code => `<option value="${escapeHtml(code)}">${escapeHtml(getCountryNameOrCode(code))}</option>`).join('');
		if (available.includes(previousCountry)) country.value = previousCountry;
		root.querySelector<HTMLElement>('.local-favorites')!.innerHTML = favorites.length ? favorites.map((favorite) => {
			const available = !!resolveFavorite(favorite, logicals, options.user);
			return `<div class="local-favorite-row">
				<button type="button" data-local-action="connect-favorite" data-type="${favorite.type}" data-id="${escapeHtml(favorite.id)}" ${available ? '' : 'disabled'}>${escapeHtml(favorite.label)}${available ? '' : ' (không khả dụng)'}</button>
				<button type="button" data-local-action="remove-favorite" data-type="${favorite.type}" data-id="${escapeHtml(favorite.id)}" aria-label="${escapeHtml('Xóa ' + favorite.label)}">Xóa</button>
			</div>`;
		}).join('') : '<p>Chưa có Favorites.</p>';
		const rules = await options.getRules();
		displayedMode = rules.mode;
		root.querySelector<HTMLButtonElement>('[data-local-action="add-site"]')!.textContent =
			rules.mode === SplitTunnelingMode.Include ? 'Dùng VPN cho site này' : 'Bật Include và dùng VPN cho site này';
		root.querySelector<HTMLElement>('.local-site-description')!.textContent = siteDomain
			? `${siteDomain} — thêm đúng hostname, không tự thêm subdomain. ${rules.mode === SplitTunnelingMode.Include ? '' : 'Chuyển sang Include: chỉ các site trong danh sách dùng VPN.'}`
			: 'Mở một trang HTTP/HTTPS để thêm quy tắc. Các trang chrome:// không được hỗ trợ.';
		root.querySelector<HTMLButtonElement>('[data-local-action="add-site"]')!.disabled = busy || !siteUrl || !options.isControllable();
		root.querySelector<HTMLButtonElement>('[data-local-action="add-country"]')!.disabled = busy || !available.length;
		root.querySelector<HTMLButtonElement>('[data-local-action="add-server"]')!.disabled = busy || !options.getServer();
		root.querySelector<HTMLButtonElement>('[data-local-action="import"]')!.disabled = busy || !pending || !options.isControllable();
	};
	const run = async (action: () => Promise<void>) => {
		if (busy) return;
		busy = true;
		root.setAttribute('aria-busy', 'true');
		root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(element => {element.disabled = true;});
		try { await action(); } catch (error) { say(error instanceof Error ? error.message : String(error)); }
		finally {
			busy = false;
			root.setAttribute('aria-busy', 'false');
			root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(element => {element.disabled = false;});
			await render().catch(error => say(String(error)));
		}
	};
	root.addEventListener('click', event => {
		const button = (event.target as Element).closest<HTMLButtonElement>('[data-local-action]');
		if (!button || button.disabled) return;
		void run(async () => {
			const action = button.dataset['localAction'];
			// Reread storage before each mutation; never merge into an old snapshot.
			favorites = validateFavorites((await favoriteStore.get())?.value || []);
			if (action === 'add-site') {
				if (!options.isControllable()) throw new Error('Quy tắc đang được quản trị viên quản lý.');
				const tab = await getCurrentTab();
				if (!tab?.url || !/^https?:\/\//i.test(tab.url)) throw new Error('Hãy mở một trang HTTP/HTTPS.');
				// The label described the captured site's mode. Refuse a tab switch.
				if (normalizeDomain(tab.url) !== siteDomain) throw new Error('Tab đã thay đổi. Hãy mở lại popup.');
				const currentRules = await options.getRules();
				if (currentRules.mode !== displayedMode) throw new Error('Chế độ định tuyến đã thay đổi. Hãy mở lại popup.');
				await options.save(addCurrentSite(currentRules, tab.url));
				say('Đã bật Include và lưu site. Nếu VPN chưa kết nối, hãy bấm Connect.');
			} else if (action === 'add-country') {
				const favorite: Favorite = {type: 'country', id: country.value, label: getCountryNameOrCode(country.value)};
				if (!resolveFavorite(favorite, options.getLogicals(), options.user)) throw new Error('Quốc gia không khả dụng.');
				await options.save(undefined, mergeFavorites(favorites, [favorite]));
				say('Đã lưu quốc gia yêu thích.');
			} else if (action === 'add-server') {
				const server = options.getServer();
				if (!server) throw new Error('Hãy kết nối VPN trước khi lưu máy chủ.');
				const favorite: Favorite = {type: 'server', id: `${server.id}`, label: server.name};
				await options.save(undefined, mergeFavorites(favorites, [favorite]));
				say('Đã lưu máy chủ yêu thích.');
			} else if (action === 'remove-favorite' || action === 'connect-favorite') {
				const favorite = favorites.find(item => item.type === button.dataset['type'] && item.id === button.dataset['id']);
				if (!favorite) throw new Error('Danh sách đã thay đổi. Hãy thử lại.');
				if (action === 'remove-favorite') {
					await options.save(undefined, favorites.filter(item => item !== favorite));
					say('Đã xóa Favorite.');
				} else {
					const logical = resolveFavorite(favorite, options.getLogicals(), options.user);
					if (!logical) throw new Error('Máy chủ không khả dụng với tài khoản hiện tại.');
					await options.connect(logical);
					say('Đã gửi yêu cầu kết nối. Kiểm tra trạng thái VPN phía trên.');
				}
			} else if (action === 'export') {
				const content = exportSettings(await options.getRules(), favorites);
				const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
				const link = document.createElement('a');
				link.href = url;
				link.download = 'vpn-site-router-settings.json';
				document.body.append(link);
				link.click(); link.remove();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				say('Đã xuất quy tắc và Favorites.');
			} else if (action === 'import' && pending) {
				if (!options.isControllable()) throw new Error('Quy tắc đang được quản trị viên quản lý.');
				const rules = mergeRules(await options.getRules(), pending.rules);
				const mergedFavorites = mergeFavorites(favorites, pending.favorites);
				await options.save(rules, mergedFavorites);
				pending = undefined;
				input.value = '';
				root.querySelector<HTMLElement>('.local-import-preview')!.textContent = '';
				say('Đã gộp dữ liệu; giữ nguyên chế độ và quy tắc cũ.');
			}
		});
	});
	input.addEventListener('change', () => {
		void run(async () => {
			pending = undefined;
			root.querySelector<HTMLElement>('.local-import-preview')!.textContent = '';
			const file = input.files?.[0];
			if (!file) return;
			if (file.size > maxBackupBytes) throw new Error('File JSON tối đa 1 MiB.');
			pending = importSettings(await file.text());
			root.querySelector<HTMLElement>('.local-import-preview')!.textContent =
				`${pending.rules.value.length} quy tắc, ${pending.favorites.length} Favorites. Bấm Nhập để gộp; không đổi mode hiện tại.`;
		});
	});
	void (async () => {
		try {
			const tab = await getCurrentTab();
			if (tab?.url && /^https?:\/\//i.test(tab.url)) {siteDomain = normalizeDomain(tab.url); siteUrl = tab.url;}
			await render();
		} catch (error) { say(String(error)); }
	})();
	return {refresh() { if (!busy) void render().catch(error => say(String(error))); }};
};
