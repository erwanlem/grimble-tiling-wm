import {Switches} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { enableWindowTheme } from '../theme.js';
import Grimble from "../extension.js"

export default class SwitchHandler {
    _switchs : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Grimble) {
        this._windowManager = windowManager;
        this._switchs = Switches.getSwitches();
        this._switchs.forEach(key => {
            extension._settings?.connect(
                "changed::" + key,
                () => this._onSwitchChanged(key, extension)
            );
        });
    }


    _onSwitchChanged(key : string, extension : Grimble) {
        switch (key) {
            case "header-bar":
                if (extension.metadata && extension._settings?.get_boolean('header-bar')) {
                    enableWindowTheme();
                } else if (extension.metadata) {
                    enableWindowTheme();
                }
                
                break;

            case "highlight-focus":
                if (extension.metadata && extension._settings?.get_boolean('highlight-focus'))
                    this._windowManager.getFocusRect().enable();
                else if (extension.metadata)
                    this._windowManager.getFocusRect().disable();
                break;

            default:
                break;
        }
    }
}