import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const PaypalLink = 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=53CWA7NR743WC&item_name=Support+ArcMenu&source=url';
const BuyMeACoffeeLink = 'https://buymeacoffee.com/azaech';

function openUri(uri) {
    Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
}

/**
 * A MessageTray notification that alerts the user that ArcMenu has received an update
 *
 * Shows users what's new and displays donation options.
 *
 * Shown only once per new release.
 * @param {*} extension
 */

export const UpdateNotifier = class UpdateNotifier {
    constructor(extension) {
        this._extension = extension;
        this._metadata = this._extension.metadata;
        this._iconPath = `${this._extension.path}/icons/hicolor/16x16/actions/settings-arcmenu-logo.svg`;
        this._version = this._metadata['version-name'] ? this._metadata['version-name'] : this._metadata.version.toString();

        this._whatsNewLink = `https://gitlab.com/arcmenu/ArcMenu/-/releases/v${this._version}`;

        this._showNotification();
    }

    _showNotification() {
        const title = _('ArcMenu v%s Released!').format(this._version);
        const body = _('Thank you for using ArcMenu! If you enjoy it and would like to help support its continued development, please consider making a donation. Your support, no matter the amount, makes a big difference.');
        const iconPath = `${this._extension.path}/icons/hicolor/16x16/actions/settings-arcmenu-logo.svg`;

        // Use MessageTray.SystemNotificationSource for GNOME versions < 46
        if (MessageTray.SystemNotificationSource) {
            const source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);

            const notification = new MessageTray.Notification(source, title, body, {
                gicon: Gio.icon_new_for_string(iconPath),
            });

            notification.setUrgency(MessageTray.Urgency.CRITICAL);
            notification.resident = true;
            this._addNotificationActions(notification);

            source.showNotification(notification);
        } else {
            const source = MessageTray.getSystemSource();
            const notification = new MessageTray.Notification({
                source,
                title,
                body,
                gicon: Gio.icon_new_for_string(iconPath),
            });

            notification.urgency = MessageTray.Urgency.CRITICAL;
            notification.resident = true;
            this._addNotificationActions(notification);

            source.addNotification(notification);
        }
    }

    _addNotificationActions(notification) {
        notification.addAction(_("What's new?"), () => openUri(this._whatsNewLink));
        notification.addAction(_('Donate via PayPal'), () => openUri(PaypalLink));
        notification.addAction(_('Buy Me a Coffee'), () => openUri(BuyMeACoffeeLink));
    }
};
