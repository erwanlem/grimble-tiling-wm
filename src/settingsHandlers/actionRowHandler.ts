import {ActionRow} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import Grimble from "../extension.js"
import Gtk from 'gi://Gtk';

export default class ActionRowHandler {
    _spins : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Grimble) {
        this._windowManager = windowManager;
        this._spins = ActionRow.getActionRow();
        this._spins.forEach(key => {
            extension._settings?.connect(
                "changed::" + key,
                () => this._onActionRowChanged(key, extension)
            );
        });
    }

    _onActionRowChanged(key : string, extension : Grimble) {
        switch (key) {
            case "select-rect-color":
                console.warn("Select color");
                if (extension.metadata && extension._settings?.get_string('select-rect-color'))
                    this._windowManager.updateColorRect();
                
                break;

            default:
                break;
        }
    }
}