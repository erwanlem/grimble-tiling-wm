import { ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import Gio from 'gi://Gio';

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