import { ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import St from 'gi://St';

export var originalLayout : string;
export var originalTiling : boolean;
export var originalTheme : string | undefined;


/** Modify gnome settings for Grimble
 * 
 */
export function enableWindowTheme() {

    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.wm.preferences' });
    //originalLayout = settings.get_string('button-layout');
    settings.set_string('button-layout', ':');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    //originalTiling = settings.get_boolean('edge-tiling');
    settings.set_boolean('edge-tiling', false);

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    //originalTiling = settings.get_boolean('workspaces-only-on-primary');
    settings.set_boolean('workspaces-only-on-primary', false);
}

/** Reset Gnome settings
 * 
 */
export function disableWindowTheme() {

    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.wm.preferences' });
    settings.reset('button-layout');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    settings.reset('edge-tiling');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    settings.reset('workspaces-only-on-primary');
}



export class FocusColor {

    _colorRect : St.Widget;
    _focusSignal : number | undefined;
    _posSignal : number | undefined;
    _sizeSignal : number | undefined;
    _lastWindow : Meta.Window | undefined;
    _settings : Gio.Settings|null;

    constructor(settings : Gio.Settings|null) {
        this._settings = settings;
        let color;
        let size;
        if (this._settings) {
            color = this._settings.get_string('select-rect-color');
            size = this._settings.get_int('focus-rect-size');
        } else {
            color = "black";
            size = 1;
        }
        this._colorRect = new St.Widget({
            style: 
               `border: ${size}px solid;
                border-color: ${color};
                background-color: transparent;`,
            reactive: false,
        });
    }


    private updateFocusRect(window : Meta.Window | undefined = undefined) {
        let windows = global.display.get_tab_list(
            Meta.TabList.NORMAL_ALL,
            null
        );

        if (windows.length === 0) {
            this._colorRect.hide();
            return;
        }

        let win;
        if (!window)
            win = global.display.get_focus_window();
        else
            win = window;
        if (!win) {
            if (this._sizeSignal) this._lastWindow?.disconnect(this._sizeSignal);
            if (this._posSignal) this._lastWindow?.disconnect(this._posSignal);
            this._sizeSignal = undefined;
            this._posSignal = undefined;
            this._colorRect.hide();
            return;
        }
        
        let app = Shell.WindowTracker.get_default().get_window_app(win);

        if (win && win.get_window_type() === Meta.WindowType.NORMAL 
                && app 
                && !app.get_id().startsWith('window:')) {
            this._colorRect.show();
            let rect = win.get_frame_rect();

            if (this._sizeSignal) this._lastWindow?.disconnect(this._sizeSignal);
            if (this._posSignal) this._lastWindow?.disconnect(this._posSignal);

            this._colorRect.set_position(rect.x, rect.y);
            this._colorRect.set_size(rect.width, rect.height);

            this._posSignal = win.connect('position-changed', () => this.updateFocusRect());
            this._sizeSignal = win.connect('size-changed', () => this.updateFocusRect());
            this._lastWindow = win;

            global.window_group.set_child_above_sibling(this._colorRect, null);
        }
    }

    public updateColor() {
        let color;
        let size;
        if (this._settings) {
            color = this._settings.get_string('select-rect-color');
            size = this._settings.get_int('focus-rect-size');
        }   
        else {
            color = "black";
            size = 2;
        }
        
        this._colorRect.set_style(`
            border: ${size}px solid;
            border-color: ${color};
            background-color: transparent;`);
        this.updateFocusRect(this._lastWindow);
    }

    public enable() {
        let windows = global.display.get_tab_list(
            Meta.TabList.NORMAL_ALL,
            null
        );
        if (windows.length >= 2)
            // If more than two it probably means that there is at least the settings 
            // window and other windows behind it. We try to avoid the settings window.
            this.updateFocusRect(windows[1]);
        global.window_group.add_child(this._colorRect);

        this._focusSignal = global.display.connect('notify::focus-window', () => {
            this.updateFocusRect();
        });
    }

    public disable() {
        if (this._focusSignal) {
            if (this._sizeSignal) this._lastWindow?.disconnect(this._sizeSignal);
            if (this._posSignal) this._lastWindow?.disconnect(this._posSignal);
            global.display.disconnect(this._focusSignal);
            this._focusSignal = undefined;
            this._posSignal = undefined;
            this._sizeSignal = undefined;
            this._lastWindow = undefined;
            global.window_group.remove_child(this._colorRect);
        }
    }

    public destroy() {
        this.disable();
        this._colorRect.destroy();
    }

}