import Gio from 'gi://Gio';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as ExtensionTheme from './theme.js';
import { TileWindowManager } from './tileWindowManager.js';
import KeybindingHandler from './settingsHandlers/keybindingHandler.js';
import SwitchHandler from './settingsHandlers/switchHandler.js';
import SpinHandler from './settingsHandlers/spinHandler.js';
import { Tile } from './tile.js';
import { loadExecutables, destroy as unloadExecutables } from './autocomplete.js';


export default class Grimble extends Extension {
  _tileWindowManager?: TileWindowManager;
  _settings : Gio.Settings | null = null;
  _keybindingHandler : KeybindingHandler | undefined;
  _switchHandler : SwitchHandler | undefined;
  _spinHandler : SpinHandler | undefined;

  enable() {
    this._settings = this.getSettings();
    
    ExtensionTheme.enableWindowTheme();
    Tile.padding = this._settings.get_int('tile-padding');

    this._tileWindowManager = new TileWindowManager(this);
    this._keybindingHandler = new KeybindingHandler(this._tileWindowManager, this);
    this._switchHandler = new SwitchHandler(this._tileWindowManager, this);
    this._spinHandler = new SpinHandler(this._tileWindowManager, this);

    loadExecutables();
  }

  disable() {
    unloadExecutables();
    this._tileWindowManager?._saveBeforeSessionLock();

    // Restore theme
    ExtensionTheme.disableWindowTheme();

    this._tileWindowManager?.destroy();
    this._tileWindowManager = undefined;

    this._keybindingHandler?.destroy();
    this._keybindingHandler = undefined;

    this._spinHandler = undefined;
    this._switchHandler = undefined;
    this._settings = null;    
  }
}