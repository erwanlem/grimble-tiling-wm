import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

const executables : Set<string> = new Set();
export const gnomeExecutables : Map<string, Gio.AppInfo> = new Map();

export function load_executables() {
    let path = GLib.getenv("PATH");
    if (!path)
        return;
    let paths = path?.split(":");

    paths.forEach(el => {
        let dir = Gio.File.new_for_path(el);
        let enumerator;
            enumerator = dir.enumerate_children_async(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_LOW,
                null,
                (source, result) => {
                    try {
                        if (!source)
                            return;
                        let enumerator = source.enumerate_children_finish(result);

                        let file;
                        while ((file = enumerator.next_file(null)) !== null) {
                            let name = file.get_name();
                            if (!executables.has(name))
                                executables.add(name);
                        }

                        enumerator.close(null);
                    } catch (e) {
                        return;
                    }
                }
            );
    });

    GLib.idle_add(GLib.PRIORITY_LOW, () => {
        Shell.AppSystem.get_default().get_installed().forEach(app => {
            let name = app.get_display_name() ?? app.get_name();
            let exe = app.get_commandline() ?? null;
            console.warn(`name=${name}, exe=${exe}`);
            if (!gnomeExecutables.has(name) && exe)
                gnomeExecutables.set(name.toLowerCase(), app);
        });
        
        return GLib.SOURCE_REMOVE;
    });
}


export function autocomplete(word : string) : Array<string> {
    word = word.toLowerCase();

    let matches : Array<string> = [];

    gnomeExecutables.forEach((e, w) => w.startsWith(word) && w !== word && e !== null ? matches.push(w) : -1);    
    executables.forEach(w => w.startsWith(word) && w !== word ? matches.push(w) : -1);
    
    matches.sort((a, b) => a.length < b.length ? -1 : 1);

    return matches;
}