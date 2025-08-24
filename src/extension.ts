import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ExtensionTheme from './theme.js';
import { TileWindowManager } from './tileWindowManager.js';
import KeybindingHandler from './settingsHandlers/keybindingHandler.js';
import SwitchHandler from './settingsHandlers/switchHandler.js';


export default class Gtile extends Extension {
  _tileWindowManager?: TileWindowManager;
  _settings : Gio.Settings | null = null;
  _keybindingHandler : KeybindingHandler | undefined;
  _switchHandler : SwitchHandler | undefined;

  enable() {
    this._settings = this.getSettings();

    // put a new theme to remove windows header bars
    ExtensionTheme.enableWindowTheme(this.metadata);
    
    this._tileWindowManager = new TileWindowManager();
    this._keybindingHandler = new KeybindingHandler(this._tileWindowManager, this._settings);
    this._switchHandler = new SwitchHandler(this._tileWindowManager, this._settings);
  }

  disable() {
    // Restore theme
    ExtensionTheme.disableWindowTheme(this.metadata);

    this._tileWindowManager?.destroy();
    this._tileWindowManager = undefined;

    this._keybindingHandler?.destroy();
    this._keybindingHandler = undefined;
  }
}