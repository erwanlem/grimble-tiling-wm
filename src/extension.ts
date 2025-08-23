import Gio from 'gi://Gio';
import St from 'gi://St';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ExtensionTheme from './theme.js';
import { TileWindowManager } from './tileWindowManager.js';


export default class MyExtension extends Extension {
  gsettings?: Gio.Settings
  _tileWindowManager?: TileWindowManager;
  _settings : Gio.Settings | null = null;

  enable() {
    this._settings = this.getSettings();

    this._settings.connect('changed::display-mouse', (settings, key) => {
            console.debug(`${key} = ${settings.get_value(key).print(true)}`);
        });

    // We put a new theme to remove windows header bars
    ExtensionTheme.enableWindowTheme(this.metadata);
    this._tileWindowManager = new TileWindowManager();
  }

  disable() {
    // Restore theme
    ExtensionTheme.disableWindowTheme(this.metadata);

    this._tileWindowManager?.disable();

    this._tileWindowManager?._resetWindows();

    this._tileWindowManager = undefined;

  }
}