/* Applications overview tooltip
 *
 * Preferences dialog
 */

import Gio from "gi://Gio";
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"

export default class ApplicationOverviewTooltipPreferences extends ExtensionPreferences {

	fillPreferencesWindow(window) {
		// Prepare labels and controls
		let buildable = new Gtk.Builder();
		buildable.add_from_file( this.dir.get_path() + '/prefs.xml' );

		// Bind fields to settings
		let settings = this.getSettings();
		settings.bind('hoverdelay', buildable.get_object('field_hoverdelay'), 'value', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('labelshowtime', buildable.get_object('field_labelshowtime'), 'value', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('labelhidetime', buildable.get_object('field_labelhidetime'), 'value', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('appdescription', buildable.get_object('field_appdescription'), 'active', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('groupappcount', buildable.get_object('field_groupappcount'), 'active', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('borders', buildable.get_object('field_borders'), 'active', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('keyboard', buildable.get_object('field_keyboard'), 'active', Gio.SettingsBindFlags.DEFAULT);
		settings.bind('title', buildable.get_object('field_title'), 'active', Gio.SettingsBindFlags.DEFAULT);

		// Fill in about page from metadata
		buildable.get_object('about_name').set_text(this.metadata.name.toString());
		buildable.get_object('about_version').set_text(this.metadata.version.toString());
		buildable.get_object('about_description').set_text(this.metadata.description.toString());
		buildable.get_object('about_url').set_markup("<a href=\"" + this.metadata.url.toString() + "\">" + this.metadata.url.toString() + "</a>");

		// Pref window layout
		window.search_enabled = true;
		window.add( buildable.get_object('page_basic') );
		window.add( buildable.get_object('page_advanced') );
		window.add( buildable.get_object('page_about') );
	}

}
