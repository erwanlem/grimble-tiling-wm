import Gio from 'gi://Gio';

import {Switches} from '../prefs/settings.js';
import { TileWindowManager } from '../tileWindowManager.js';


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
    }
}