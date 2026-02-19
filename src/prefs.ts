import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import './prefs/shortcutListener.js';
import {Shortcut, Switches, Radio, Spin, Combo, ActionRow} from './common.js';
import { getKeybindingController } from './keybindingController.js';
import {saveConfiguration} from './utils.js';

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
        this._bindActionRow(builder, settings);

        return page1;
    }

    createKeybindingsPage(builder: any, settings : Gio.Settings) {

        const page2 : Adw.PreferencesPage = builder.get_object('keybindings');

        const comboRow = Combo.getCombo();
        comboRow.forEach(({ key, rowNames }) => {
            const combo = builder.get_object(key.replaceAll('-', '_'));
            let lastValue = settings.get_string(key);
            let row = rowNames.findIndex(item => lastValue === item);
            if (row === -1)
                row = 0;
            combo.set_selected(row);
            
            combo.connect('notify::selected-item', (widget : any) => {
                settings.set_string(key, rowNames[widget.get_selected()]);
            });

            getKeybindingController().connect('keybinding-changed', () => {
                combo.set_selected(rowNames.findIndex(item => 'Custom' === item));
                const shortcuts = Shortcut.getShortcuts();
                let o : Record<string, string[]> = {};
                for (const p of shortcuts) {
                    o[p] = settings.get_strv(p)??[];
                }
                saveConfiguration("custom.json", o);
            });
        });

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

    private _bindActionRow(builder: any, settings : Gio.Settings) {
        const actionRow : Array<string> = ActionRow.getActionRow();

        actionRow.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
            switch (key) {
                case "select-rect-color":
                    const colorButton = new Gtk.ColorDialogButton({
                        dialog: new Gtk.ColorDialog()
                    });

                    let rgba = new Gdk.RGBA();
                    rgba.parse(settings.get_string("select-rect-color"));
                    colorButton.set_rgba(rgba);

                    colorButton.connect("notify::rgba", () => {
                        const color = colorButton.get_rgba();
                        settings.set_string("select-rect-color", color.to_string());
                    });

                    (widget as Adw.ActionRow).add_suffix(colorButton);
                    (widget as Adw.ActionRow).activatable_widget = colorButton;

                    settings.bind('highlight-focus', widget, "sensitive", Gio.SettingsBindFlags.DEFAULT);

                    break;
    
                default:
                    break;
            }
        });
    }

    private _bindSpinbuttons(builder: any, settings : Gio.Settings) {
        const spinButtons = Spin.getSpins();

        spinButtons.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'value', Gio.SettingsBindFlags.DEFAULT);
            switch (key) {
                case "focus-rect-size":
                    settings.bind('highlight-focus', widget, "sensitive", Gio.SettingsBindFlags.DEFAULT);
                    break;
    
                default:
                    break;
            }
        });
    }
}

