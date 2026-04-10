import {Switches} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { enableWindowTheme } from '../theme.js';
import Grimble from "../extension.js"
import {switchCloseButton} from "../theme.js";

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
                    enableWindowTheme(extension._settings.get_boolean('hide-close-button')??false);
                } else if (extension.metadata) {
                    enableWindowTheme(extension._settings?.get_boolean('hide-close-button')??false);
                }
                

            case "highlight-focus":
                if (extension.metadata && extension._settings?.get_boolean('highlight-focus'))
                    this._windowManager.getFocusRect().enable();
                else if (extension.metadata)
                    this._windowManager.getFocusRect().disable();
                break;
            case "hide-close-button":
                if (extension.metadata && extension._settings?.get_boolean('hide-close-button'))
                    switchCloseButton(true);
                else
                    switchCloseButton(false);

            default:
                break;
        }
    }
}