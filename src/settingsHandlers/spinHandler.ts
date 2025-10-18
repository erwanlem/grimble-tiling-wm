import {Spin} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { Tile } from '../tile.js';
import Grimble from "../extension.js"

export default class SpinHandler {
    _spins : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Grimble) {
        this._windowManager = windowManager;
        this._spins = Spin.getSpins();
        this._spins.forEach(key => {
            extension._settings?.connect(
                "changed::" + key,
                () => this._onSwitchChanged(key, extension)
            );
        });
    }

    _onSwitchChanged(key : string, extension : Grimble) {
        switch (key) {
            case "tile-padding":
                if (extension.metadata && extension._settings?.get_int('tile-padding')) {
                    Tile.padding = extension._settings.get_int('tile-padding');
                    this._windowManager.updateMonitors();
                }
                
                break;

            default:
                break;
        }
    }
}