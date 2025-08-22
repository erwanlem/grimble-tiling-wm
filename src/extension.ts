import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';


import * as ExtensionTheme from './theme.js';
import { TileWindowManager } from './tileWindowManager.js';


export default class MyExtension extends Extension {
  gsettings?: Gio.Settings
  _tileWindowManager?: TileWindowManager;

  enable() {
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