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
import { initializeSafely } from "./lifecycle.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

/**
 * An abstract class representing a destructible extension.
 *
 * This class handles the infrastructure for enabling and disabling the
 * extension; implementations only need to provide initialization.
 */
export class DestructibleExtension extends Extension {
    enabledExtension;

    get version() {
        return this.metadata["version-name"] ?? "n/a";
    }

    /**
     * Enable this extension.
     *
     * If not already enabled, call `initialize` and keep track its allocated resources.
     */
    enable() {
        if (!this.enabledExtension) {
            console.log(`Enabling extension ${this.metadata.uuid} ${this.version}`);
            this.enabledExtension = initializeSafely((destroyer) => {
                this.initialize(destroyer);
            });
            console.log(`Extension ${this.metadata.uuid} ${this.version} successfully enabled`);
        }
    }

    /**
     * Disable this extension.
     *
     * If existing, destroy the allocated resources of `initialize`.
     */
    disable() {
        console.log(`Disabling extension ${this.metadata.uuid} ${this.version}`);
        this.enabledExtension?.destroy();
        this.enabledExtension = null;
    }
}
