import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

import {Shortcut} from '../prefs/settings.js';
import { TileWindowManager, Direction } from '../tileWindowManager.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gdk from 'gi://Gdk';

/**
 * Class to handle the keyboard shortcuts (on the extension side) except the
 * ones related to the Layouts. For those, see layoutsManager.js.
 */

export default class KeybindingHandler {
    _keyBindings : Array<string>;
    _windowManager : TileWindowManager;
    _extensionObject : Extension | null = null;
    _settings : Gio.Settings;

    _waitingAction : string | undefined;
    _enableArrow : boolean = false;


    constructor(windowManager : TileWindowManager, settings : Gio.Settings) {
        this._settings = settings;
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
        this.disableArrowBinding();
    }


    private enableArrowBinding() {
        let bindings = ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'key-escape'];
        bindings.forEach(key => {
            Main.wm.addKeybinding(
                key,
                this._settings,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL,
                this._onCustomKeybindingPressed.bind(this, key)
            );
        });
    }

    private disableArrowBinding() {
        let bindings = ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'key-escape'];
        bindings.forEach(key => Main.wm.removeKeybinding(key));
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
            case 'keybinding-move':
                this._waitingAction = shortcutName;
                this.enableArrowBinding();
                break;

            case 'keybinding-resize':
                this._waitingAction = shortcutName;
                this.enableArrowBinding();
                break;

            case 'arrow-up':
                if (this._waitingAction === 'keybinding-move') {
                    this._windowManager.moveTile(Direction.North);
                    this.disableArrowBinding();
                } else if (this._waitingAction === 'keybinding-resize') {
                    this._windowManager.resizeFocusedWindow(Meta.GrabOp.RESIZING_N);
                }
                break;
            case 'arrow-down':
                if (this._waitingAction === 'keybinding-move') {
                    this._windowManager.moveTile(Direction.South);
                    this.disableArrowBinding();
                } else if (this._waitingAction === 'keybinding-resize') {
                    this._windowManager.resizeFocusedWindow(Meta.GrabOp.RESIZING_S);
                }
                break;
            case 'arrow-left':
                if (this._waitingAction === 'keybinding-move') {
                    this._windowManager.moveTile(Direction.West);
                    this.disableArrowBinding();
                } else if (this._waitingAction === 'keybinding-resize') {
                    this._windowManager.resizeFocusedWindow(Meta.GrabOp.RESIZING_W);
                }
                break;
            case 'arrow-right':
                if (this._waitingAction === 'keybinding-move') {
                    this._windowManager.moveTile(Direction.East);
                    this.disableArrowBinding();
                } else if (this._waitingAction === 'keybinding-resize') {
                    this._windowManager.resizeFocusedWindow(Meta.GrabOp.RESIZING_E);
                }
                break;
            case 'key-escape':
                this.disableArrowBinding();
                break;

            default:
                break;
        }
    }
}
