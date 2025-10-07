import Gio from 'gi://Gio';

import {Switches} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import { enableWindowTheme } from '../theme.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';


export default class SwitchHandler {
    _switchs : Array<string>;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Extension) {
        this._windowManager = windowManager;
        this._switchs = Switches.getSwitches();
        this._switchs.forEach(key => {
            extension.getSettings().connect(
                "changed::" + key,
                () => this._onSwitchChanged(key, extension)
            );
        });
    }


    _onSwitchChanged(key : string, extension : Extension) {
        switch (key) {
            case "header-bar":
                if (extension.metadata && extension.getSettings().get_boolean('header-bar')) {
                    enableWindowTheme();
                } else if (extension.metadata) {
                    enableWindowTheme();
                }
                
                break;

            default:
                break;
        }
    }
}