import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

export class AzureImageProvider {
    _baseURLAsset;
    _cachedAssets;

    constructor() {
        // TODO: load entire blob list in assets/*

        this._baseURLAsset = 'https://stttoolsstorage.blob.core.windows.net/assets/'
        this._cachedAssets = new Set();
    }

    formatUrl(url) {
		return (url.startsWith('/') ? '' : '_') + url.replace(new RegExp('/', 'g'), '_') + '.png';
	}

    getCached(withIcon) {
        if (!withIcon.icon)
            return '';

        if (!withIcon.icon.file)
            return '';

        return this.internalGetCached(withIcon.icon.file);
    }

    internalGetCached(url) {
        if (this._cachedAssets.has(this.formatUrl(url))) {
            return this._baseURLAsset + this.formatUrl(url);
        } else {
            return '';
        }
    }

    getCrewCached(crew, fullBody) {
        return this.internalGetCached(fullBody ? crew.full_body.file : crew.portrait.file);
    }

    getSpriteCached(assetName, spriteName) {
        return this.internalGetCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
    }

    getCrewImageUrl(crew, fullBody, id) {
        return this.getImageUrl(fullBody ? crew.full_body.file : crew.portrait.file, id);
    }

    getShipImageUrl(ship, id) {
        return this.getImageUrl(ship.icon.file, id);
    }

    getItemImageUrl(item, id) {
        return this.getImageUrl(item.icon.file, id);
    }

    getFactionImageUrl(faction, id) {
        return this.getImageUrl(faction.icon.file, id);
    }

    async getSprite(assetName, spriteName, id) {
        let assetUrl = STTApi.networkHelper.post('https://stttools.azurewebsites.net/api/getasset', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig.config.asset_bundle_version,
            "asset_file": assetName,
            "sprite_name": spriteName
        });

        return { id, url: assetUrl };
    }

    async getImageUrl(iconFile, id) {
        let assetUrl = STTApi.networkHelper.post('https://stttools.azurewebsites.net/api/getasset', {
            "client_platform": CONFIG.CLIENT_PLATFORM,
            "client_version": CONFIG.CLIENT_VERSION,
            "asset_server": STTApi.serverConfig.config.asset_server,
            "asset_bundle_version": STTApi.serverConfig.config.asset_bundle_version,
            "asset_file": iconFile
        });

        return { id, url: assetUrl };
    }
}