import { ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export var originalLayout : string;
export var originalTiling : boolean;
export var originalTheme : string | undefined = undefined;

function writeFile(path : string, content : string) {
    let file = Gio.File.new_for_path(path);

    try {
        // Write content, overwrite if file exists
        file.replace_contents(
            content,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null
        );
    } catch (e) {
        console.error("Write error " + e);
        return null;
    }
}

function readFile(path : string) {
    try {
        let file = Gio.File.new_for_path(path);
        let [ok, contents] = file.load_contents(null);
        if (ok) {
            let decoder = new TextDecoder("utf-8");
            return decoder.decode(contents);
        }
    } catch (e) {
        console.error("Read error " + e);
        return null;
    }
    return null;
}


export function enableWindowTheme(metadata : ExtensionMetadata, hideHeaderBar = false) {

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


export function disableWindowTheme(metadata : ExtensionMetadata) {

    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.wm.preferences' });
    settings.reset('button-layout');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    settings.reset('edge-tiling');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    settings.reset('workspaces-only-on-primary');
}


function reload_gtk_theme() {
    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
    let theme = settings.get_string('gtk-theme');
    settings.set_string('gtk-theme', '');
    setTimeout(() => {
        settings.set_string('gtk-theme', theme);
    }, 1000);
}