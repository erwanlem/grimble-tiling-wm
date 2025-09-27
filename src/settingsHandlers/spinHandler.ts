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
                () => this._onSwitchChanged(key, settings)
            );
        });
    }

    _onSwitchChanged(key : string, settings : Gio.Settings) {
        let extensionObject;
        let metadata;
        switch (key) {
            case "tile-padding":
                extensionObject = Extension.lookupByUUID('grimble@lmt.github.io');
                metadata = extensionObject?.metadata;
                if (metadata && settings.get_int('tile-padding')) {
                    Tile.padding = settings.get_int('tile-padding');
                    this._windowManager.updateMonitors();
                }
                
                break;

            default:
                break;
        }
    }
}