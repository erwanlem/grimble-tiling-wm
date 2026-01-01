import {Combo, Shortcut} from '../common.js';
import { TileWindowManager } from '../tileWindowManager.js';
import Grimble from "../extension.js";
import { loadConfiguration, saveConfiguration } from '../utils.js';
import GLib from 'gi://GLib';

export default class ComboRowHandler {
    _combos;
    _windowManager : TileWindowManager;

    constructor(windowManager : TileWindowManager, extension : Grimble) {
        this._windowManager = windowManager;
        this._combos = Combo.getCombo();

        this._combos.forEach(({ key }) => {
            extension._settings?.connect(
                "changed::" + key,
                () => this._onComboChanged(key, extension)
            );
        });
    }


    _onComboChanged(key : string, extension : Grimble) {
        const shortcuts = Shortcut.getShortcuts();
        switch (key) {
            case "keybinding-config":
                if (extension.metadata && extension._settings?.get_string('keybinding-config')) {
                    let conf = extension._settings?.get_string('keybinding-config');

                    if (conf === "i3") {
                        loadConfiguration(`${extension.path}/configs/i3.json`, (c => {
                            
                            if (extension._settings) {
                                for (const p of shortcuts) {
                                    if (c[p]) {
                                        extension._settings.set_strv(p, [c[p]]);
                                    } else {
                                        extension._settings.set_strv(p, []);
                                    }
                                }
                            }
                        }), () => {});
                        
                    } else if (conf === "Grimble") {
                        loadConfiguration(`${extension.path}/configs/grimble.json`, (c => {
                            
                            if (extension._settings) {
                                for (const p of shortcuts) {
                                    if (c[p]) {
                                        extension._settings.set_strv(p, [c[p]]);
                                    } else {
                                        extension._settings.set_strv(p, []);
                                    }
                                }
                            }
                        }), () => {});
                    } else if (conf === "None") {
                        loadConfiguration(`${extension.path}/configs/default.json`, (c => {
                            
                            if (extension._settings) {
                                for (const p of shortcuts) {
                                    if (c[p]) {
                                        extension._settings.set_strv(p, [c[p]]);
                                    } else {
                                        extension._settings.set_strv(p, []);
                                    }
                                }
                            }
                        }), () => {});
                    } else if (conf === "Custom") {
                        const userPath = GLib.get_user_config_dir();

                        let o : Record<string, string[]> = {};
                        for (const p of shortcuts) {
                            o[p] = extension._settings.get_strv(p)??[];
                        }

                        loadConfiguration(`${userPath}/grimble/config/custom.json`, (c => {
                            if (extension._settings) {
                                for (const p of shortcuts) {
                                    if (c[p]) {
                                        extension._settings.set_strv(p, c[p]);
                                    } else {
                                        extension._settings.set_strv(p, []);
                                    }
                                }
                            }
                        }), () => {saveConfiguration(`custom.json`, o);});
                    }
                }
                
                break;

            default:
                break;
        }
    }
}