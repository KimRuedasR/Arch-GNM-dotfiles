/* extension.js
 *
 * Copyright (C) 2024 Zacharie DUBRULLE
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of
 * the GNU General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MediaSection } from 'resource:///org/gnome/shell/ui/mpris.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { QuickSettingsMenu } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { LibPanel, Panel } from './libs/libpanel/main.js';
import { update_settings } from './libs/preferences.js';
import { ApplicationsMixer, ApplicationsMixerToggle, AudioProfileSwitcher, BalanceSlider, SinkMixer, waitProperty } from './libs/widgets.js';
const DateMenu = Main.panel.statusArea.dateMenu;
const QuickSettings = Main.panel.statusArea.quickSettings;
const CalendarMessageList = DateMenu._messageList;
const MediaSection_DateMenu = CalendarMessageList._mediaSection;
const SystemItem = QuickSettings._system._systemItem;
// _volumeOutput is always defined here because `./libs/widgets.js` wait on it
const OutputVolumeSlider = QuickSettings._volumeOutput._output;
export default class QSAP extends Extension {
    settings;
    async enable() {
        this.InputVolumeIndicator = await waitProperty(QuickSettings, '_volumeInput');
        this.InputVolumeSlider = this.InputVolumeIndicator._input;
        this.settings = this.getSettings();
        update_settings(this.settings);
        this._scasis_callback = this.settings.connect('changed::always-show-input-volume-slider', () => this._set_always_show_input(this.settings.get_boolean('always-show-input-volume-slider')));
        this.settings.emit('changed::always-show-input-volume-slider', 'always-show-input-volume-slider');
        this._scscd_callback = this.settings.connect('changed::master-volume-sliders-show-current-device', () => {
            if (this.settings.get_boolean('master-volume-sliders-show-current-device')) {
                this._patch_show_current_device(OutputVolumeSlider);
                this._patch_show_current_device(this.InputVolumeSlider);
            }
            else {
                this._unpatch_show_current_device(OutputVolumeSlider);
                this._unpatch_show_current_device(this.InputVolumeSlider);
            }
        });
        this.settings.emit('changed::master-volume-sliders-show-current-device', 'master-volume-sliders-show-current-device');
        this._master_volumes = [];
        this._sc_callback = this.settings.connect('changed', (_, name) => {
            if (name !== "autohide-profile-switcher") {
                this._refresh_panel();
            }
        });
        this._refresh_panel();
    }
    disable() {
        this.settings.disconnect(this._scscd_callback);
        this._unpatch_show_current_device(OutputVolumeSlider);
        this._unpatch_show_current_device(this.InputVolumeSlider);
        this.settings.disconnect(this._scasis_callback);
        this.settings.disconnect(this._sc_callback);
        for (const id of waitProperty.idle_ids) {
            GLib.Source.remove(id);
        }
        waitProperty.idle_ids = null;
        this._set_always_show_input(false);
        this._cleanup_panel();
        this.settings = null;
    }
    _refresh_panel() {
        this._cleanup_panel();
        const panel_type = this.settings.get_string("panel-type");
        const merged_panel_position = this.settings.get_string("merged-panel-position");
        const remove_output_volume_slider = this.settings.get_boolean("remove-output-volume-slider");
        const move_output_volume_slider = this.settings.get_boolean('move-output-volume-slider');
        const move_input_volume_slider = this.settings.get_boolean('move-input-volume-slider');
        const create_mpris_controllers = this.settings.get_boolean("create-mpris-controllers");
        const create_applications_volume_sliders = this.settings.get_boolean('create-applications-volume-sliders');
        const create_perdevice_volume_sliders = this.settings.get_boolean('create-perdevice-volume-sliders');
        const create_balance_slider = this.settings.get_boolean('create-balance-slider');
        const create_profile_switcher = this.settings.get_boolean('create-profile-switcher');
        const widgets_order = this.settings.get_strv('widgets-order');
        if (move_output_volume_slider || move_input_volume_slider || create_mpris_controllers || create_applications_volume_sliders || create_perdevice_volume_sliders || remove_output_volume_slider || create_balance_slider || create_profile_switcher) {
            if (panel_type === "independent-panel")
                LibPanel.enable();
            this._panel = LibPanel.main_panel;
            let index = -1;
            if (panel_type === "separate-indicator") {
                this._indicator = new PanelMenu.Button(0.0, "Audio panel", true);
                this._indicator.add_child(new St.Icon({ style_class: 'system-status-icon', icon_name: 'audio-x-generic-symbolic' }));
                this._panel = new QuickSettingsMenu(this._indicator, 2);
                // Since the panel contains no element that have a minimal width (like QuickToggle)
                // we need to force it to take the same with as a normal panel
                this._panel.box.add_constraint(new Clutter.BindConstraint({
                    coordinate: Clutter.BindCoordinate.WIDTH,
                    source: LibPanel.main_panel._boxPointer || LibPanel.main_panel,
                }));
                // Hide the indicator when empty
                const update_visibility = () => {
                    for (const child of this._panel._grid.get_children()) {
                        if (child != this._panel._grid.layout_manager._overlay && child.visible) {
                            this._indicator.show();
                            return;
                        }
                    }
                    this._indicator.hide();
                };
                this._panel._grid.connect("child-added", (_self, child) => {
                    child._qsap_vis_changed_callback = child.connect("notify::visible", () => {
                        update_visibility();
                    });
                    update_visibility();
                });
                this._panel._grid.connect("child-removed", (_self, child) => {
                    child.disconnect(child._qsap_vis_changed_callback);
                    delete child._qsap_vis_changed_callback;
                    update_visibility();
                });
                this._indicator.setMenu(this._panel);
                Main.panel.addToStatusArea(this.uuid, this._indicator);
            }
            else if (panel_type === "independent-panel") {
                this._panel = new Panel('main');
                // Since the panel contains no element that have a minimal width (like QuickToggle)
                // we need to force it to take the same with as a normal panel
                this._panel.add_constraint(new Clutter.BindConstraint({
                    coordinate: Clutter.BindCoordinate.WIDTH,
                    source: LibPanel.main_panel,
                }));
                LibPanel.addPanel(this._panel);
            }
            if (panel_type === "merged-panel" && merged_panel_position === 'top') {
                widgets_order.reverse();
                index = this._panel.getItems().indexOf(SystemItem) + 2;
            }
            for (const widget of widgets_order) {
                if (widget === 'output-volume-slider' && move_output_volume_slider) {
                    this._move_slider(index, OutputVolumeSlider);
                }
                else if (widget === 'input-volume-slider' && move_input_volume_slider) {
                    this._move_slider(index, this.InputVolumeSlider);
                }
                else if (widget === 'mpris-controllers' && create_mpris_controllers && this.settings.get_boolean("mpris-controllers-are-moved")) {
                    this._move_media_controls(index);
                }
                else if (widget === 'mpris-controllers' && create_mpris_controllers && !this.settings.get_boolean("mpris-controllers-are-moved")) {
                    this._create_media_controls(index);
                }
                else if (widget === 'applications-volume-sliders' && create_applications_volume_sliders) {
                    this._create_app_mixer(index, this.settings.get_boolean("group-applications-volume-sliders"), this.settings.get_string("applications-volume-sliders-filter-mode"), this.settings.get_strv("applications-volume-sliders-filters"));
                }
                else if (widget === "perdevice-volume-sliders" && create_perdevice_volume_sliders) {
                    this._create_sink_mixer(index, this.settings.get_string("perdevice-volume-sliders-filter-mode"), this.settings.get_strv("perdevice-volume-sliders-filters"));
                }
                else if (widget === "balance-slider" && create_balance_slider) {
                    this._create_balance_slider(index);
                }
                else if (widget === "profile-switcher" && create_profile_switcher) {
                    this._create_profile_switcher(index);
                }
            }
            if (remove_output_volume_slider) {
                OutputVolumeSlider.visible = false;
            }
        }
    }
    _cleanup_panel() {
        OutputVolumeSlider.visible = true;
        if (!this._panel)
            return;
        if (this._profile_switcher) {
            this._panel.removeItem(this._profile_switcher);
            this._profile_switcher.destroy();
            this._profile_switcher = null;
        }
        if (this._balance_slider) {
            this._panel.removeItem(this._balance_slider);
            this._balance_slider.destroy();
            this._balance_slider = null;
        }
        if (this._sink_mixer) {
            this._sink_mixer.destroy();
            this._sink_mixer = null;
        }
        if (this._applications_mixer) {
            this._applications_mixer.destroy();
            this._applications_mixer = null;
        }
        if (this._applications_mixer_combined) {
            this._panel.removeItem(this._applications_mixer_combined);
            this._applications_mixer_combined.destroy();
            this._applications_mixer_combined = null;
        }
        if (this._media_section) {
            this._panel.removeItem(this._media_section);
            this._media_section = null;
        }
        if (MediaSection_DateMenu._qsap_moved) {
            this._panel.removeItem(MediaSection_DateMenu);
            CalendarMessageList._sectionList.insert_child_at_index(MediaSection_DateMenu, 0);
            MediaSection_DateMenu.remove_style_class_name('QSAP-media-section');
            MediaSection_DateMenu.remove_style_class_name('QSAP-media-section-optional');
            delete MediaSection_DateMenu._qsap_moved;
        }
        this._master_volumes.reverse();
        for (const [slider, index] of this._master_volumes) {
            this._panel.removeItem(slider);
            LibPanel.main_panel.addItem(slider, 2);
            LibPanel.main_panel._grid.set_child_at_index(slider, index);
        }
        this._master_volumes = [];
        if (this._indicator) {
            this._indicator.destroy(); // also destroys `this._panel``
            delete this._indicator;
        }
        else if (this._panel !== LibPanel.main_panel) {
            LibPanel.removePanel(this._panel); // prevent the panel's position being forgotten
            this._panel.destroy();
        }
        ;
        this._panel = null;
        LibPanel.disable();
    }
    _move_slider(index, slider) {
        const old_index = slider.get_parent().get_children().indexOf(slider);
        LibPanel.main_panel.removeItem(slider);
        this._panel.addItem(slider, 2);
        this._panel._grid.set_child_at_index(slider, index);
        this._master_volumes.push([slider, old_index]);
    }
    _move_media_controls(index) {
        CalendarMessageList._sectionList.remove_child(MediaSection_DateMenu);
        this._panel.addItem(MediaSection_DateMenu, 2);
        this._panel._grid.set_child_at_index(MediaSection_DateMenu, index);
        MediaSection_DateMenu._qsap_moved = true;
        MediaSection_DateMenu.add_style_class_name('QSAP-media-section');
        if (!this.settings.get_boolean('ignore-css')) {
            MediaSection_DateMenu.add_style_class_name('QSAP-media-section-optional');
        }
    }
    _create_media_controls(index) {
        this._media_section = new MediaSection();
        this._media_section.add_style_class_name('QSAP-media-section');
        if (!this.settings.get_boolean('ignore-css')) {
            this._media_section.add_style_class_name('QSAP-media-section-optional');
        }
        this._panel.addItem(this._media_section, 2);
        this._panel._grid.set_child_at_index(this._media_section, index);
    }
    _create_app_mixer(index, type, filter_mode, filters) {
        if (type === "combined") {
            this._applications_mixer_combined = new ApplicationsMixerToggle(this.settings, filter_mode, filters);
            this._panel.addItem(this._applications_mixer_combined, 2);
            this._panel._grid.set_child_at_index(this._applications_mixer_combined, index);
        }
        else {
            this._applications_mixer = new ApplicationsMixer(this._panel, index, filter_mode, filters, this.settings);
        }
    }
    _create_sink_mixer(index, filter_mode, filters) {
        this._sink_mixer = new SinkMixer(this._panel, index, filter_mode, filters);
    }
    _create_balance_slider(index) {
        this._balance_slider = new BalanceSlider(this.settings);
        this._panel.addItem(this._balance_slider, 2);
        this._panel._grid.set_child_at_index(this._balance_slider, index);
    }
    _create_profile_switcher(index) {
        this._profile_switcher = new AudioProfileSwitcher(this.settings);
        this._panel.addItem(this._profile_switcher, 1);
        this._panel._grid.set_child_at_index(this._profile_switcher, index);
    }
    _set_always_show_input(enabled) {
        if (enabled) {
            this._ivs_vis_callback = this.InputVolumeSlider.connect("notify::visible", this._reset_input_slider_vis.bind(this));
            // make sure to check if the icon should be shown when some events are fired.
            // we need this because we make the slider always visible, so notify::visible isn't
            // fired when gnome-shell tries to show it (because it was already visible)
            this._ivsc_sa_callback = this.InputVolumeSlider._control.connect("stream-added", this._reset_input_slider_vis.bind(this));
            this._ivsc_sr_callback = this.InputVolumeSlider._control.connect("stream-removed", this._reset_input_slider_vis.bind(this));
            this._ivsc_dsc_callback = this.InputVolumeSlider._control.connect("default-source-changed", this._reset_input_slider_vis.bind(this));
            this.InputVolumeSlider.visible = true;
        }
        else {
            if (this._ivs_vis_callback)
                this.InputVolumeSlider.disconnect(this._ivs_vis_callback);
            this._ivs_vis_callback = null;
            if (this._ivsc_sa_callback)
                this.InputVolumeSlider._control.disconnect(this._ivsc_sa_callback);
            this._ivsc_sa_callback = null;
            if (this._ivsc_sr_callback)
                this.InputVolumeSlider._control.disconnect(this._ivsc_sr_callback);
            this._ivsc_sr_callback = null;
            if (this._ivsc_dsc_callback)
                this.InputVolumeSlider._control.disconnect(this._ivsc_dsc_callback);
            this._ivsc_dsc_callback = null;
            this.InputVolumeSlider.visible = this.InputVolumeSlider._shouldBeVisible();
            this.InputVolumeIndicator.visible = this.InputVolumeSlider._shouldBeVisible();
        }
    }
    _reset_input_slider_vis() {
        if (!this.InputVolumeSlider.visible) {
            this.InputVolumeSlider.visible = true;
        }
        this.InputVolumeIndicator.visible = this.InputVolumeSlider._shouldBeVisible();
    }
    // Base slider
    // slider: OutputStreamSlider
    //   box: StBoxLayout
    //     slider._iconButton: StButton
    //     sliderBin: StBin
    //     slider._menuButton: StButton
    //     
    // Modified slider
    // slider: OutputStreamSlider
    //   box: StBoxLayout
    //     slider._iconButton: StButton
    //     vbox: StBoxLayout (NEW)
    //       label: StLabel (NEW)
    //       hbox: StBoxLayout (NEW)
    //         sliderBin: StBin
    //         slider._menuButton: StButton
    _patch_show_current_device(slider) {
        if (slider._qsap_callback)
            return;
        slider._iconButton._qsap_y_expand = slider._iconButton.y_expand;
        slider._iconButton._qsap_y_align = slider._iconButton.y_align;
        slider._iconButton.y_expand = false;
        slider._iconButton.y_align = Clutter.ActorAlign.CENTER;
        const box = slider.child;
        const sliderBin = box.get_children()[1];
        box.remove_child(sliderBin);
        const menu_button_visible = slider._menuButton.visible;
        box.remove_child(slider._menuButton);
        const vbox = new St.BoxLayout({ vertical: true, x_expand: true });
        box.insert_child_at_index(vbox, 1);
        const hbox = new St.BoxLayout();
        hbox.add_child(sliderBin);
        hbox.add_child(slider._menuButton);
        slider._menuButton.visible = menu_button_visible; // we need to reset `actor.visible` when changing parent
        // this prevent the tall panel bug when the button is shown
        slider._menuButton._qsap_y_expand = slider._menuButton.y_expand;
        slider._menuButton.y_expand = false;
        const label = new St.Label({ natural_width: 0 });
        label.style_class = "QSAP-application-volume-slider-label";
        const signal_name = slider == OutputVolumeSlider ? "active-output-update" : "active-input-update";
        slider._qsap_callback = slider._control.connect(signal_name, () => {
            const device_id = slider._control.lookup_device_from_stream(slider._stream).get_id();
            // using the item's text allow for compatibility with extensions that changes it, let's hope this won't break
            slider._deviceItems.get(device_id).label.bind_property('text', label, 'text', GObject.BindingFlags.SYNC_CREATE);
        });
        if (slider._stream) {
            const device_id = slider._control.lookup_device_from_stream(slider._stream).get_id();
            slider._deviceItems.get(device_id).label.bind_property('text', label, 'text', GObject.BindingFlags.SYNC_CREATE);
        }
        ;
        vbox.add_child(label);
        vbox.add_child(hbox);
    }
    _unpatch_show_current_device(slider) {
        if (!slider._qsap_callback)
            return;
        slider._control.disconnect(slider._qsap_callback);
        slider._iconButton.y_expand = slider._iconButton._qsap_y_expand;
        slider._iconButton.y_align = slider._iconButton._qsap_y_align;
        const menu_button_visible = slider._menuButton.visible;
        const box = slider.child;
        const vbox = box.get_children()[1];
        const hbox = vbox.get_children()[1];
        const sliderBin = hbox.get_children()[0];
        box.remove_child(vbox);
        hbox.remove_child(sliderBin);
        hbox.remove_child(slider._menuButton);
        box.add_child(sliderBin);
        box.add_child(slider._menuButton);
        // we need to reset `actor.visible` when changing parent
        slider._menuButton.visible = menu_button_visible;
        slider._menuButton.y_expand = slider._menuButton._qsap_y_expand;
        delete slider._qsap_callback;
        delete slider._iconButton._qsap_y_expand;
        delete slider._iconButton._qsap_y_align;
        delete slider._menuButton._qsap_y_expand;
    }
}
