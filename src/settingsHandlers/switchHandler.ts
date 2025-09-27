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
                () => this._onSwitchChanged(key, settings)
            );
        });
    }


    _onSwitchChanged(key : string, settings : Gio.Settings) {
        let extensionObject;
        let metadata;
        switch (key) {
            case "header-bar":
                extensionObject = Extension.lookupByUUID('grimble@lmt.github.io');
                metadata = extensionObject?.metadata;
                if (metadata && settings.get_boolean('header-bar')) {
                    enableWindowTheme();
                } else if (metadata) {
                    enableWindowTheme();
                }
                
                break;

            default:
                break;
        }
    }
}