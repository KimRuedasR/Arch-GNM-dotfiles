// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Alternatively, the contents of this file may be used under the terms
// of the GNU General Public License Version 2 or later, as described below:
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
import GObject from "gi://GObject";
import St from "gi://St";
import Meta from "gi://Meta";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

export const X11SessionIndicator = GObject.registerClass(class X11SessionIndicator extends PanelMenu.Button {
    constructor(iconLoader) {
        super(0, "X11 session", true);
        this.add_child(new St.Icon({
            styleClass: "system-status-icon",
            gicon: iconLoader.loadIcon("x11-symbolic"),
        }));
        this.setSensitive(false);
    }
});

export const XWaylandWindowIndicator = GObject.registerClass(class XWaylandWindowIndicator extends PanelMenu.Button {
    constructor(iconLoader) {
        super(0, "XWayland Window", true);
        this.add_child(new St.Icon({
            styleClass: "system-status-icon",
            gicon: iconLoader.loadIcon("window-x11-symbolic"),
        }));
        this.setSensitive(false);
        this.markWindow(null);
    }

    markWindow(window) {
        const clientType = window?.get_client_type();
        this.visible = clientType === Meta.WindowClientType.X11;
    }
});
