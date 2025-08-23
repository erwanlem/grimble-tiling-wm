import { ExtensionMetadata } from '@girs/gnome-shell/extensions/extension';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export var originalLayout : string;
export var originalTiling : boolean;
export var originalTheme : string;

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
        console.warn("Write error " + e);
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
        console.warn("Read error " + e);
        return null;
    }
    return null;
}


export function enableWindowTheme(metadata : ExtensionMetadata) {
    let gtkTheme = readFile(metadata.path + "/gtktheme.css");
    let original = readFile(GLib.get_home_dir() + "/.config/gtk-3.0/gtk.css");

    if (original)
        originalTheme = original;

    if (gtkTheme) {
        writeFile(GLib.get_home_dir() + "/.config/gtk-3.0/gtk.css", gtkTheme);
        writeFile(GLib.get_home_dir() + "/.config/gtk-4.0/gtk.css", gtkTheme);
    }

    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.wm.preferences' });
    originalLayout = settings.get_string('button-layout');
    settings.set_string('button-layout', ':');

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    originalTiling = settings.get_boolean('edge-tiling');
    settings.set_boolean('edge-tiling', false);
}


export function disableWindowTheme(metadata : ExtensionMetadata) {
    if (originalTheme) {
        writeFile(GLib.get_home_dir() + "/.config/gtk-3.0/gtk.css", originalTheme);
        writeFile(GLib.get_home_dir() + "/.config/gtk-4.0/gtk.css", originalTheme);
    }

    let settings = new Gio.Settings({ schema: 'org.gnome.desktop.wm.preferences' });
    if (originalLayout)
        settings.set_string('button-layout', originalLayout);

    settings = new Gio.Settings({ schema: 'org.gnome.mutter' });
    if (originalTiling != null)
        settings.set_boolean('edge-tiling', originalTiling);
}