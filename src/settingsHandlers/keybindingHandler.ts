import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import {Shortcut} from '../prefs/settings.js';
import { TileWindowManager, Direction } from '../tileWindowManager.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Class to handle the keyboard shortcuts (on the extension side) except the
 * ones related to the Layouts. For those, see layoutsManager.js.
 */

export default class KeybindingHandler {
    _keyBindings : Array<string>;
    _windowManager : TileWindowManager;
    _extensionObject : Extension | null = null;

    constructor(windowManager : TileWindowManager, settings : Gio.Settings) {
        this._extensionObject = Extension.lookupByUUID('gtile@lmt.github.io');
        this._windowManager = windowManager;
        this._keyBindings = Shortcut.getShortcuts();
        this._keyBindings.forEach(key => {
            Main.wm.addKeybinding(
                key,
                settings,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL,
                this._onCustomKeybindingPressed.bind(this, key)
            );
        });
    }

    destroy() {
        this._keyBindings.forEach(key => Main.wm.removeKeybinding(key));
    }

    /**
     * @param {string} shortcutName
     */
    async _onCustomKeybindingPressed(shortcutName : string) {
        console.warn("Keybinding pressed : " + shortcutName);

        switch (shortcutName) {
            case 'keybinding-close':
                global.display.get_focus_window().delete(global.get_current_time());
                break;

            case 'keybinding-open-settings':
                this._extensionObject?.openPreferences();
                break;

            case 'keybinding-rotation':
                this._windowManager.rotateWindow(global.display.get_focus_window());
                break;

            case 'keybinding-maximize':
                this._windowManager.maximizeTile(global.display.get_focus_window());
                break;

            case 'keybinding-search':
                this._windowManager.createSearchBar();
                break;

            case 'keybinding-refresh':
                this._windowManager.refresh();
                break;
            case 'keybinding-move-left':
                this._windowManager.moveTile(Direction.West);
                break;
            case 'keybinding-move-right':
                this._windowManager.moveTile(Direction.East);
                break;
            case 'keybinding-move-top':
                this._windowManager.moveTile(Direction.North);
                break;
            case 'keybinding-move-bottom':
                this._windowManager.moveTile(Direction.South);
                break;

            default:
                break;
        }
    }
}
