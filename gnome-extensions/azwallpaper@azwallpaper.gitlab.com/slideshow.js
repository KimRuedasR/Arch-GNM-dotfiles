import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {debugLog, notify} from './utils.js';

Gio._promisify(Gio.File.prototype, 'query_info_async', 'query_info_finish');

const DELAY_TIME = 5;

function fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        const b = array[i];
        array[i] = array[randomIndex];
        array[randomIndex] = b;
    }
}

function isValidDirectory(extension, slideshowDirectory) {
    const directory = Gio.file_new_for_path(slideshowDirectory);

    if (!slideshowDirectory || !directory.query_exists(null)) {
        notify(_('Slideshow directory not found'), _('Change directory in settings to begin slideshow'),
            _('Open Settings'), () => extension.openPreferences());
        return false;
    }

    return true;
}

async function isValidFile(file) {
    let info;
    try {
        info = await file.query_info_async(
            Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
            Gio.FileQueryInfoFlags.NONE, 0, null);
    } catch (e) {
        return false;
    }

    const contentType = info.get_content_type();
    return contentType.startsWith('image/');
}

export const Slideshow = class AzSlideShow {
    constructor(extension) {
        this._extension = extension;
        this._settings = this._extension.settings;
        this._wallpaperQueue = null;
        this._backgroundSettings = new Gio.Settings({schema: 'org.gnome.desktop.background'});
        this._loadSlideshowQueue();
    }

    initiate() {
        const slideshowDirectory = this._settings.get_string('slideshow-directory');
        if (!isValidDirectory(this._extension, slideshowDirectory)) {
            this._monitorSlideshowDirectory();
            return;
        }

        debugLog('Initiate slideshow.');
        this._createFileMonitor();
        this._queryWallpapersExist(this._wallpaperQueue);

        const timer = this._getTimerDelay();
        this._slideshowStartTime = Date.now();
        this._settings.set_uint64('slideshow-time-of-slide-start', this._slideshowStartTime);

        debugLog('Starting slideshow...');
        this.startSlideshow(timer, true);
        debugLog(`Wallpapers in queue: ${this._wallpaperQueue.length}`);
        debugLog(`Next slide in ${timer} seconds.`);
    }

    _queryWallpapersExist(wallpaperList) {
        debugLog('Checking if wallpapers exist...');
        const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');
        for (let i = wallpaperList.length - 1; i >= 0; i--) {
            const imageName = wallpaperList[i];
            const filePath = GLib.build_filenamev([slideshowDirectoryPath, imageName]);
            const file = Gio.file_new_for_path(filePath);
            if (!file.query_exists(null)) {
                debugLog(`File not found. Removing ${filePath}`);
                wallpaperList.splice(i, 1);
            }
        }
        debugLog('Check complete!');
    }

    _loadSlideshowQueue(createNewList = false) {
        const wallpaperQueue = this._settings.get_strv('slideshow-wallpaper-queue');
        if (wallpaperQueue.length === 0 || createNewList) {
            const wallpaperList = this._getWallpaperList();
            fisherYatesShuffle(wallpaperList);
            this._settings.set_strv('slideshow-wallpaper-queue', wallpaperList);
        }
        this._wallpaperQueue = this._settings.get_strv('slideshow-wallpaper-queue');
    }

    _getSlideshowStatus() {
        const status = {};
        if (this._wallpaperQueue.length === 0) {
            debugLog('Error - Wallpaper Queue Empty');
            status.isEmpty = true;
        }
        return status;
    }

    startSlideshow(delay = this._getSlideDuration(), runOnce = false) {
        this._endSlideshow();

        const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');

        if (!runOnce)
            debugLog(`Next slide in ${delay} seconds.`);

        this._slideshowId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, delay, () => {
            const slideshowStatus = this._getSlideshowStatus();

            // 'slideshow-wallpaper-queue' has no wallpapers in queue, try to load a new slideshow queue
            if (slideshowStatus.isEmpty) {
                debugLog('Wallpaper queue empty. Attempting to create new slideshow...');

                this._loadSlideshowQueue(true);
                const newSlideshowStatus = this._getSlideshowStatus();

                // if 'slideshow-wallpaper-queue still empty, cancel slideshow
                if (newSlideshowStatus.isEmpty) {
                    notify(_('Slideshow contains no slides'), _('Change directory in settings to begin slideshow'),
                        _('Open Settings'), () => this._extension.openPreferences());
                    this._slideshowId = null;
                    return GLib.SOURCE_REMOVE;
                }

                debugLog('Success! Starting new slideshow...');
                // If the new wallpaperQueue first entry is the same as the previous wallpaper,
                // remove first entry and push to end of queue.
                if (this._wallpaperQueue[0] === this._settings.get_string('slideshow-current-wallpapper')) {
                    const duplicate = this._wallpaperQueue.shift();
                    this._wallpaperQueue.push(duplicate);
                }
            }

            const randomWallpaper = this._wallpaperQueue.shift();

            this._settings.set_string('slideshow-current-wallpapper', randomWallpaper);
            this._settings.set_strv('slideshow-wallpaper-queue', this._wallpaperQueue);

            debugLog('Changing wallpaper...');

            const filePath = GLib.build_filenamev([slideshowDirectoryPath, randomWallpaper]);

            this._backgroundSettings.set_string('picture-uri', `file://${filePath}`);
            this._backgroundSettings.set_string('picture-uri-dark', `file://${filePath}`);

            debugLog(`Current wallpaper "${randomWallpaper}"`);
            debugLog(`Wallpapers in queue: ${this._wallpaperQueue.length}`);

            // Store the time of when the wallpaper changed.
            this._slideshowStartTime = Date.now();
            this._settings.set_uint64('slideshow-time-of-slide-start', this._slideshowStartTime);
            const slideDuration = this._getSlideDuration();
            this._settings.set_int('slideshow-timer-remaining', slideDuration);

            if (runOnce) {
                this.startSlideshow(slideDuration);
                return GLib.SOURCE_REMOVE;
            }

            debugLog(`Next slide in ${delay} seconds.`);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _endSlideshow() {
        if (this._slideshowId) {
            GLib.source_remove(this._slideshowId);
            this._slideshowId = null;
        }
    }

    _clearFileMonitor() {
        if (this._fileMonitor) {
            debugLog('Clear FileMonitor');
            if (this._fileMonitorChangedId) {
                debugLog('Disconnect FileMonitor ChangedId');
                this._fileMonitor.disconnect(this._fileMonitorChangedId);
                this._fileMonitorChangedId = null;
            }
            this._fileMonitor.cancel();
            this._fileMonitor = null;
        }
    }

    _monitorSlideshowDirectory() {
        this._clearFileMonitor();
        const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');
        const dir = Gio.file_new_for_path(slideshowDirectoryPath);
        this._fileMonitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._fileMonitor.set_rate_limit(1000);
        this._fileMonitorChangedId = this._fileMonitor.connect('changed', (_monitor, file, otherFile, eventType) => {
            if (eventType === Gio.FileMonitorEvent.CREATED && file.get_path() === slideshowDirectoryPath)
                this.restart();
        });
    }

    _createFileMonitor() {
        this._clearFileMonitor();

        const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');
        const dir = Gio.file_new_for_path(slideshowDirectoryPath);
        this._fileMonitor = dir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOUNTS | Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._fileMonitor.set_rate_limit(1000);
        this._fileMonitorChangedId = this._fileMonitor.connect('changed', async (_monitor, file, otherFile, eventType) => {
            const currentWallpaper = this._settings.get_string('slideshow-current-wallpapper');
            const fileName = file.get_basename();

            const index = this._wallpaperQueue.indexOf(fileName);
            const fileInQueue = index >= 0;

            const newFileName = otherFile?.get_basename();

            switch (eventType) {
            case Gio.FileMonitorEvent.DELETED:
            case Gio.FileMonitorEvent.MOVED_OUT:
                if (fileInQueue) {
                    this._wallpaperQueue.splice(index, 1);
                    this._settings.set_strv('slideshow-wallpaper-queue', this._wallpaperQueue);
                    debugLog(`Remove "${fileName}" from index:${index}`);
                } else if (currentWallpaper === fileName) {
                    // The deleted file was the current wallpaper, go to next slide in queue
                    this.startSlideshow(0, true);
                } else if (file.get_path() === slideshowDirectoryPath) {
                    this.restart();
                }
                break;
            case Gio.FileMonitorEvent.CREATED:
            case Gio.FileMonitorEvent.MOVED_IN: {
                const validFile = await isValidFile(file);
                if (!validFile) {
                    debugLog(`"${fileName}" is not a valid image.`);
                    break;
                }

                // insert new files randomly into wallpapers queue
                const randomIndex = Math.floor(Math.random() * this._wallpaperQueue.length);
                this._wallpaperQueue.splice(randomIndex, 0, fileName);
                this._settings.set_strv('slideshow-wallpaper-queue', this._wallpaperQueue);
                debugLog(`Insert "${fileName}" at index:${randomIndex}`);
                break;
            }
            case Gio.FileMonitorEvent.RENAMED: {
                const validNewFile = await isValidFile(otherFile);

                if (fileInQueue && validNewFile) {
                    // Replace the old file with the new file
                    this._wallpaperQueue.splice(index, 1, newFileName);
                    debugLog(`Rename "${fileName}" at index:${index} to "${newFileName}"`);
                } else if (fileInQueue && !validNewFile) {
                    // Remove the old file from the queue
                    this._wallpaperQueue.splice(index, 1);
                    debugLog(`Remove "${fileName}" from index:${index}`);
                    debugLog(`"${newFileName}" is not a valid image.`);
                } else if (validNewFile) {
                    // The old file wasn't in queue, but the renamed file's type is valid.
                    // Add it to queue.
                    const randomIndex = Math.floor(Math.random() * this._wallpaperQueue.length);
                    this._wallpaperQueue.splice(randomIndex, 0, newFileName);
                    debugLog(`Insert "${newFileName}" at index:${randomIndex}`);
                } else {
                    debugLog(`"${newFileName}" is not a valid image.`);
                    break;
                }

                this._settings.set_strv('slideshow-wallpaper-queue', this._wallpaperQueue);

                if (currentWallpaper === fileName) {
                    // The renamed file was the current wallpaper, go to next slide in queue
                    this.startSlideshow(0, true);
                }
                break;
            }
            case Gio.FileMonitorEvent.UNMOUNTED: {
                if (file.get_path() === slideshowDirectoryPath)
                    this.restart();

                break;
            }
            default:
                break;
            }
        });
    }

    _getWallpaperList() {
        debugLog('Get Wallpaper List');
        const wallpaperPaths = [];

        try {
            const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');
            const dir = Gio.file_new_for_path(slideshowDirectoryPath);

            const fileEnum = dir.enumerate_children('standard::name,standard::type,standard::content-type', Gio.FileQueryInfoFlags.NONE, null);

            let info;
            while ((info = fileEnum.next_file(null))) {
                const fileName = info.get_name();
                const contentType = info.get_content_type();

                if (contentType.startsWith('image/'))
                    wallpaperPaths.push(fileName);
            }
        } catch (e) {
            debugLog(e);
        }

        return wallpaperPaths;
    }

    durationChanged() {
        const useAbsoluteTime = this._settings.get_boolean('slideshow-use-absolute-time-for-duration');
        if (useAbsoluteTime)
            debugLog('Switching to absolute time for slide duration. Restart Slideshow.');
        else
            debugLog('Switching to image on screen time for slide duration. Restart Slideshow.');

        this._settings.set_int('slideshow-timer-remaining', this._getSlideDuration());
        this._settings.set_uint64('slideshow-time-of-slide-start', Date.now());
        const timer = this._getTimerDelay();
        this.startSlideshow(timer, true);
        this._slideshowStartTime = Date.now();
    }

    _getSlideDuration() {
        const [hours, minutes, seconds] = this._settings.get_value('slideshow-slide-duration').deep_unpack();
        const durationInSeconds = (hours * 3600) + (minutes * 60) + seconds;

        // Cap slide duration minimum to 5 seconds
        return Math.max(durationInSeconds, DELAY_TIME);
    }

    _getElapsedTime() {
        const lastSlideTime = this._settings.get_uint64('slideshow-time-of-slide-start');
        const dateNow = Date.now();

        const elapsedTime = dateNow - lastSlideTime;

        return elapsedTime;
    }

    _getTimerDelay() {
        const slideDuration = this._getSlideDuration();
        const remainingTimer = this._settings.get_int('slideshow-timer-remaining');
        const useAbsoluteTime = this._settings.get_boolean('slideshow-use-absolute-time-for-duration');

        if (!useAbsoluteTime) {
            if (remainingTimer === 0 || remainingTimer <= slideDuration)
                return Math.max(remainingTimer, 0);

            return slideDuration;
        }

        const lastSlideTime = this._settings.get_uint64('slideshow-time-of-slide-start');
        // This only occurs when 'slideshow-time-of-slide-start' is set to the default value.
        if (lastSlideTime === 0) {
            this._settings.set_int('slideshow-timer-remaining', slideDuration);
            return slideDuration;
        }

        const remainingTimerMs = remainingTimer * 1000;
        const elapsedTimeMs = this._getElapsedTime();

        const hasTimerElapsed = elapsedTimeMs >= remainingTimerMs;
        if (hasTimerElapsed) {
            debugLog('Time elapsed exceeded slide duration. Next slide in 5 seconds.');
            this._settings.set_int('slideshow-timer-remaining', DELAY_TIME);
            return DELAY_TIME;
        }

        const absoluteTimeRemaining = Math.floor((remainingTimerMs - elapsedTimeMs) / 1000);
        const remainingTime = Math.max(absoluteTimeRemaining, DELAY_TIME);
        this._settings.set_int('slideshow-timer-remaining', remainingTime);

        debugLog(`Time elapsed has not exceeded slide duration. Next slide in ${remainingTime} seconds.`);

        return remainingTime;
    }

    restart() {
        this._endSlideshow();
        this._clearFileMonitor();
        this._loadSlideshowQueue();

        const slideshowDirectoryPath = this._settings.get_string('slideshow-directory');
        const currentSlidePath = this._settings.get_string('slideshow-current-wallpapper');
        const filePath = GLib.build_filenamev([slideshowDirectoryPath, currentSlidePath]);

        this._backgroundSettings.set_string('picture-uri', `file://${filePath}`);
        this._backgroundSettings.set_string('picture-uri-dark', `file://${filePath}`);

        this.initiate();
    }

    reset() {
        debugLog('Reset slideshow');
        this._settings.set_strv('slideshow-wallpaper-queue', []);
        this._settings.set_int('slideshow-timer-remaining', 0);
        this._settings.set_uint64('slideshow-time-of-slide-start', 0);

        this._endSlideshow();
        this._clearFileMonitor();
        this._loadSlideshowQueue();
        this.initiate();
    }

    saveTimer() {
        const slideShowEndTime = Date.now();
        const elapsedTime = Math.floor((slideShowEndTime - this._slideshowStartTime) / 1000);

        const timerRemaining = this._settings.get_int('slideshow-timer-remaining');
        const remainingTimer = Math.max(timerRemaining - elapsedTime, 0);

        debugLog(`Total 'On' Time: ${elapsedTime}`);
        debugLog(`Save remaining timer: ${remainingTimer}`);
        this._settings.set_int('slideshow-timer-remaining', remainingTimer);
        this._settings.set_uint64('slideshow-time-of-slide-start', slideShowEndTime);
    }

    destroy() {
        this.saveTimer();
        this._endSlideshow();
        this._clearFileMonitor();
        this._backgroundSettings = null;
    }
};
