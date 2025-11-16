import {Combo, Shortcut} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import Grimble from "../extension.js";
import { loadConfiguration } from '../utils.js';
import GLib from 'gi://GLib';

export default class ComboRowHandler {
    _combos;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Grimble) {
        this._windowManager = windowManager;
        this._combos = Combo.getCombo();

        this._combos.forEach(({ key, rowNames }) => {
            extension._settings?.connect(
                "changed::" + key,
                () => this._onComboChanged(key, extension)
            );
        });
    }


    _onComboChanged(key : string, extension : Grimble) {
        let shortcuts = Shortcut.getShortcuts();
        switch (key) {
            case "keybinding-config":
                if (extension.metadata && extension._settings?.get_string('keybinding-config')) {
                    let conf = extension._settings?.get_string('keybinding-config');

                    if (conf === "i3") {
                        let conf = loadConfiguration(`${extension.path}/configs/i3.json`);
                        for (const p of shortcuts) {
                            if (conf[p]) {
                                extension._settings.set_strv(p, [conf[p]]);
                            } else {
                                extension._settings.set_strv(p, []);
                            }
                        }
                    } else if (conf === "Grimble") {
                        let conf = loadConfiguration(`${extension.path}/configs/grimble.json`);
                        for (const p of shortcuts) {
                            if (conf[p]) {
                                extension._settings.set_strv(p, [conf[p]]);
                            } else {
                                extension._settings.set_strv(p, []);
                            }
                        }
                    } else if (conf === "None") {
                        let conf = loadConfiguration(`${extension.path}/configs/default.json`);
                        for (const p of shortcuts) {
                            if (conf[p]) {
                                extension._settings.set_strv(p, [conf[p]]);
                            } else {
                                extension._settings.set_strv(p, []);
                            }
                        }
                    } else if (conf === "Custom") {
                        const userPath = GLib.get_user_config_dir();
                        let conf = loadConfiguration(`${userPath}/grimble/config/custom.json`);
                        if (conf === null)
                            return;
 
                        for (const p of shortcuts) {
                            if (conf[p]) {
                                extension._settings.set_strv(p, conf[p]);
                            } else {
                                extension._settings.set_strv(p, []);
                            }
                        }
                    }
                }
                
                break;

            default:
                break;
        }
    }
}