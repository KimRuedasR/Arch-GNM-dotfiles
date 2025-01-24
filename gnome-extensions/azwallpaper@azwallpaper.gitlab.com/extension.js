import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as LoginManager from 'resource:///org/gnome/shell/misc/loginManager.js';

import {BingWallpaperDownloader} from './bingWallpaperDownloader.js';
import {Slideshow} from './slideshow.js';
import {debugLog} from './utils.js';

export default class AzWallpaper extends Extension {
    enable() {
        this._settings = this.getSettings();

        this._slideshow = new Slideshow(this);
        this._bingWallpaperDownloader = new BingWallpaperDownloader(this);
        this._injectionManager = new InjectionManager();

        this._injectionManager.overrideMethod(Main.layoutManager, '_addBackgroundMenu', originalMethod => {
            const azWallpaper = this;
            return function (bgManager) {
                /* eslint-disable-next-line no-invalid-this */
                originalMethod.call(this, bgManager);
                const menu = bgManager.backgroundActor._backgroundMenu;
                azWallpaper._modifyBackgroundMenu(menu);
            };
        });

        this._settings.connectObject('changed::slideshow-slide-duration', () => this._slideshow.durationChanged(), this);
        this._settings.connectObject('changed::slideshow-directory', () => this._slideshow.reset(), this);
        this._settings.connectObject('changed::slideshow-use-absolute-time-for-duration', () => this._slideshow.durationChanged(), this);

        this._settings.connectObject('changed::bing-wallpaper-download', () => this._bingWallpaperDownloadChanged(), this);
        this._settings.connectObject('changed::bing-download-directory', () => this._restartBingWallpaperDownloader(), this);
        this._settings.connectObject('changed::bing-wallpaper-market', () => this._restartBingWallpaperDownloader(), this);
        this._settings.connectObject('changed::bing-wallpaper-download-count', () => this._restartBingWallpaperDownloader(), this);
        this._settings.connectObject('changed::bing-wallpaper-resolution', () => this._restartBingWallpaperDownloader(), this);
        this._settings.connectObject('changed::bing-wallpaper-delete-old', () => {
            const [deletionEnabled, daysToDeletion_] = this._settings.get_value('bing-wallpaper-delete-old').deep_unpack();
            if (deletionEnabled)
                this._bingWallpaperDownloader.maybeDeleteOldWallpapers();
            else
                this._settings.set_strv('bing-wallpapers-downloaded', []);
        }, this);

        if (!Main.layoutManager._startingUp) {
            this._startExtension();
        } else {
            Main.layoutManager.connectObject('startup-complete', () =>
                this._startExtension(), this);
        }

        // Connect to a few signals to store the remaining time of a slide.
        // disable() isn't called on shutdown, restart, etc.
        const loginManager = LoginManager.getLoginManager();
        loginManager.connectObject('prepare-for-sleep', () =>
            this._slideshow?.saveTimer(), this);

        global.connectObject('shutdown', () =>
            this._slideshow?.saveTimer(), this);

        global.display.connectObject('x11-display-closing', () =>
            this._slideshow?.saveTimer(), this);
    }

    _startExtension() {
        this._delayStartId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 3, () => {
            if (this._settings.get_boolean('bing-wallpaper-download'))
                this._bingWallpaperDownloader.initiate();

            this._slideshow.initiate();
            Main.layoutManager._updateBackgrounds();

            this._delayStartId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    get settings() {
        return this._settings;
    }

    disable() {
        if (this._delayStartId) {
            GLib.source_remove(this._delayStartId);
            this._delayStartId = null;
        }

        this._injectionManager.clear();
        this._injectionManager = null;

        Main.layoutManager._updateBackgrounds();

        const loginManager = LoginManager.getLoginManager();
        loginManager.disconnectObject(this);

        Main.layoutManager.disconnectObject(this);
        global.display.disconnectObject(this);
        global.disconnectObject(this);

        this._bingWallpaperDownloader.destroy();
        this._bingWallpaperDownloader = null;
        this._slideshow.destroy();
        this._slideshow = null;
        this._settings.disconnectObject(this);
        this._settings = null;
    }

    _bingWallpaperDownloadChanged() {
        this._bingWallpaperDownloader.destroy();
        if (this._settings.get_boolean('bing-wallpaper-download'))
            this._bingWallpaperDownloader.initiate();
    }

    _restartBingWallpaperDownloader() {
        this._bingWallpaperDownloader.endSingleDownload();
        this._bingWallpaperDownloader.endDownloadTimer();
        if (this._settings.get_boolean('bing-wallpaper-download')) {
            this._bingWallpaperDownloader.setBingParams();
            this._bingWallpaperDownloader.setDownloadDirectory();
            this._bingWallpaperDownloader.downloadOnceWithDelay();
        }
    }

    _modifyBackgroundMenu(menu) {
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 4);

        let menuItem = new PopupMenu.PopupMenuItem(_('Next Wallpaper'));
        menuItem.connect('activate', () => {
            debugLog('\'Next Wallpaper\' clicked.');
            this._slideshow.startSlideshow(0, true);
        });
        menu.addMenuItem(menuItem, 5);

        menuItem = new PopupMenu.PopupMenuItem(_('Slideshow Settings'));
        menuItem.connect('activate', () => this.openPreferences());
        menu.addMenuItem(menuItem, 6);
    }
}
