import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import './prefs/shortcutListener.js';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class ExamplePreferences extends ExtensionPreferences {
    _settings: Gio.Settings | null = null;
    _prefWindow: Adw.PreferencesWindow | null = null;

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

        return page1;
    }

    createKeybindingsPage(builder: any, settings : Gio.Settings) {
        

        const page2 : Adw.PreferencesPage = builder.get_object('keybindings');

        let keys = [
            'keybinding-rotation',
            'keybinding-resize',
            'keybinding-move',
            'keybinding-close',
            'keybinding-search',
            'keybinding-open-settings',
            'keybinding-minimize',
            'keybinding-maximize'
        ];

        keys.forEach(key => {
            const shortcut = builder.get_object(key.replaceAll('-', '_'));
            (shortcut as any).initialize(key, settings);
        });

        return page2;
    }



    private _bindRadioButtons(builder: any, settings : Gio.Settings) {
        // These 'radioButtons' are basically just used as a 'fake ComboBox' with
        // explanations for the different options. So there is just *one* gsetting
        // (an int) which saves the current 'selection'.
        const radioButtons = [
            {
                key: 'tile-insertion-behavior',
                rowNames: [
                    'insertion_best_fit_row',
                    'insertion_focus_row'
                ]
            },
        ];

        radioButtons.forEach(({ key, rowNames }) => {
            const currActive = settings.get_int(key);

            rowNames.forEach((name, idx) => {
                const row = builder.get_object(name.replaceAll('-', '_'));
                const checkButton = row.activatable_widget;
                checkButton.connect('toggled', () => settings.set_int(key, idx));

                // Set initial state
                if (idx === currActive)
                    checkButton.activate();
            });
        });
    }
}

