import Gio from 'gi://Gio';

import {Spin} from '../prefs/settings.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Tile } from '../tile.js';


export default class SpinHandler {
    _spins : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, settings : Gio.Settings) {
        this._windowManager = windowManager;
        this._spins = Spin.getSpins();
        this._spins.forEach(key => {
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
            case "tile-padding":
                let extensionObject = Extension.lookupByUUID('grimble@lmt.github.io');
                let metadata = extensionObject?.metadata;
                if (metadata && settings.get_int('tile-padding')) {
                    console.warn('Tile padding ' + settings.get_int('tile-padding'));
                    Tile.padding = settings.get_int('tile-padding');
                    this._windowManager.updateMonitors();
                }
                
                break;

            default:
                break;
        }
    }
}