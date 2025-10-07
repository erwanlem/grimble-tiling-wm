import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import './prefs/shortcutListener.js';
import {Shortcut, Switches, Radio, Spin} from './common.js';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class GrimblePreferences extends ExtensionPreferences {

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        const builder = Gtk.Builder.new_from_file(`${this.path}/ui/prefs.ui`);

        const page1 = this.createGeneralSettingsPage(builder, settings);
        const page2 = this.createKeybindingsPage(builder, settings);

        window.add(page1);
        window.add(page2);

        return Promise.resolve();
    }



    createGeneralSettingsPage(builder: any, settings : Gio.Settings) {
        
        const page1 : Adw.PreferencesPage = builder.get_object('general');

        this._bindRadioButtons(builder, settings);
        this._bindSwitches(builder, settings);
        this._bindSpinbuttons(builder, settings);

        return page1;
    }

    createKeybindingsPage(builder: any, settings : Gio.Settings) {

        const page2 : Adw.PreferencesPage = builder.get_object('keybindings');

        let keys = Shortcut.getShortcuts();
        keys.forEach(key => {
            const shortcut = builder.get_object(key.replaceAll('-', '_'));
            (shortcut as any).initialize(key, settings);
        });

        return page2;
    }



    private _bindRadioButtons(builder: any, settings : Gio.Settings) {
        const radioButtons = Radio.getRadios();

        radioButtons.forEach(({ key, rowNames }) => {
            const currActive = settings.get_int(key);

            rowNames.forEach((name, idx) => {
                const row = builder.get_object(name.replaceAll('-', '_'));
                const checkButton = row.activatable_widget;
                checkButton.connect('toggled', () => {
                    settings.set_int(key, idx);
                });

                // Set initial state
                if (idx === currActive)
                    checkButton.activate();
            });
        });
    }

    private _bindSwitches(builder: any, settings : Gio.Settings) {
        const switches : Array<string> = Switches.getSwitches();

        switches.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    private _bindSpinbuttons(builder: any, settings : Gio.Settings) {
        const spinButtons = Spin.getSpins();

        spinButtons.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'value', Gio.SettingsBindFlags.DEFAULT);
        });
    }
}

