import Gio from 'gi://Gio';

import {Spin} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { Tile } from '../tile.js';


export default class SpinHandler {
    _spins : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Extension) {
        this._windowManager = windowManager;
        this._spins = Spin.getSpins();
        this._spins.forEach(key => {
            extension.getSettings().connect(
                "changed::" + key,
                () => this._onSwitchChanged(key, extension)
            );
        });
    }

    _onSwitchChanged(key : string, extension : Extension) {
        let extensionObject;
        let metadata;
        switch (key) {
            case "tile-padding":
                extensionObject = extension;
                metadata = extensionObject?.metadata;
                if (metadata && extension.getSettings().get_int('tile-padding')) {
                    Tile.padding = extension.getSettings().get_int('tile-padding');
                    this._windowManager.updateMonitors();
                }
                
                break;

            default:
                break;
        }
    }
}