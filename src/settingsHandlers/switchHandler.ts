import Gio from 'gi://Gio';

import {Switches} from '../prefs/settings.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { enableWindowTheme } from '../theme.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';


export default class SwitchHandler {
    _switchs : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, settings : Gio.Settings) {
        this._windowManager = windowManager;
        this._switchs = Switches.getSwitches();
        this._switchs.forEach(key => {
            settings.connect(
                "changed::" + key,
                (settings, key) => this._onSwitchChanged(key, settings)
            );
        });
    }

    destroy() {}

    _onSwitchChanged(key : string, settings : Gio.Settings) {
        console.warn(`${key} :  ${settings.get_value(key).print(true)}`);
        switch (key) {
            case "header-bar":
                let extensionObject = Extension.lookupByUUID('grimble@lmt.github.io');
                let metadata = extensionObject?.metadata;
                if (metadata && settings.get_boolean('header-bar')) {
                    enableWindowTheme(metadata, true);
                } else if (metadata) {
                    enableWindowTheme(metadata, false);
                }
                
                break;

            default:
                break;
        }
    }
}