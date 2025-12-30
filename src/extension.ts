import Gio from 'gi://Gio';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as ExtensionTheme from './theme.js';
import { TileWindowManager } from './tileWindowManager.js';
import KeybindingHandler from './settingsHandlers/keybindingHandler.js';
import SwitchHandler from './settingsHandlers/switchHandler.js';
import SpinHandler from './settingsHandlers/spinHandler.js';
import ComboRowHandler from './settingsHandlers/comboRowHandler.js';
import { Tile } from './tile.js';
import { loadExecutables, destroy as unloadExecutables } from './autocomplete.js';
import GLib from 'gi://GLib';

export default class Grimble extends Extension {
  _tileWindowManager: TileWindowManager | null = null;
  _settings : Gio.Settings | null = null;
  _keybindingHandler : KeybindingHandler | null = null;
  _switchHandler : SwitchHandler | null = null;
  _spinHandler : SpinHandler | null = null;
  _comboHandler : ComboRowHandler | null = null;

  enable() {
    this._settings = this.getSettings();
    
    ExtensionTheme.enableWindowTheme();
    Tile.padding = this._settings.get_int('tile-padding');


    /**
     * When we unlock the session (after a lock, not when starting the system),
     * there is a period of time during which the Gnome settings used for the 
     * extension are not set. If we don't wait, it leads the windows to be 
     * organized in an undefined way when using multiple monitors (because 
     * of the workspaces-only-on-primary setting). In order to fix it we 
     * wait 2 seconds to be sure everything is set up. It is applied ONLY when using 
     * multiple monitors.
     * -> Could problably be improved by waiting for the setting changed signal.
     */
    if (global.display.get_n_monitors() > 1 && TileWindowManager.locked) {
      GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
          this._tileWindowManager = new TileWindowManager(this);
          this._keybindingHandler = new KeybindingHandler(this._tileWindowManager, this);
          this._switchHandler = new SwitchHandler(this._tileWindowManager, this);
          this._spinHandler = new SpinHandler(this._tileWindowManager, this);
          this._comboHandler = new ComboRowHandler(this._tileWindowManager, this);
          return GLib.SOURCE_REMOVE;
      });
    } else {
      this._tileWindowManager = new TileWindowManager(this);
      this._keybindingHandler = new KeybindingHandler(this._tileWindowManager, this);
      this._switchHandler = new SwitchHandler(this._tileWindowManager, this);
      this._spinHandler = new SpinHandler(this._tileWindowManager, this);
      this._comboHandler = new ComboRowHandler(this._tileWindowManager, this);
    }
    

    loadExecutables();
  }

  disable() {
    unloadExecutables();
    this._tileWindowManager?._saveBeforeSessionLock();

    // Restore theme
    ExtensionTheme.disableWindowTheme();

    this._tileWindowManager?.destroy();
    this._tileWindowManager = null;

    this._keybindingHandler?.destroy();
    this._keybindingHandler = null;

    this._spinHandler = null;
    this._switchHandler = null;
    this._comboHandler = null;
    this._settings = null;    
  }
}