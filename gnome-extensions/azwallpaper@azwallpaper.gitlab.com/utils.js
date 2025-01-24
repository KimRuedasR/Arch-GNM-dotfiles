import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {domain} from 'gettext';
const {gettext: _} = domain('azwallpaper');

/**
 *
 * @param {string} message
 */
export function debugLog(message) {
    const extension = Extension.lookupByURL(import.meta.url);
    const settings = extension.getSettings();
    if (settings.get_boolean('debug-logs'))
        console.log(`Wallpaper Slideshow: ${message}`);
}

/**
 *
 * @param {string} msg A message
 * @param {string} details Additional information
 * @param {Label} actionLabel the label for the action
 * @param {Function} actionCallback the callback for the action
 */
export function notify(msg, details, actionLabel = null, actionCallback = null) {
    const extension = Extension.lookupByURL(import.meta.url);
    msg = `${_('Wallpaper Slideshow')}: ${msg}`;

    // MessageTray.SystemNotificationSource removed in GNOME 46
    if (MessageTray.SystemNotificationSource) {
        const source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);

        const notification = new MessageTray.Notification(source, msg, details, {
            gicon: Gio.icon_new_for_string(`${extension.path}/media/azwallpaper-logo.svg`),
        });

        if (actionLabel && actionCallback) {
            notification.setUrgency(MessageTray.Urgency.CRITICAL);
            notification.addAction(actionLabel, actionCallback);
        } else {
            notification.setTransient(true);
        }

        source.showNotification(notification);
    } else {
        const source = MessageTray.getSystemSource();
        const notification = new MessageTray.Notification({
            source,
            title: msg,
            body: details,
            gicon: Gio.icon_new_for_string(`${extension.path}/media/azwallpaper-logo.svg`),
        });

        if (actionLabel && actionCallback) {
            notification.urgency = MessageTray.Urgency.CRITICAL;
            notification.addAction(actionLabel, actionCallback);
        } else {
            notification.isTransient = true;
        }

        source.addNotification(notification);
    }
}
