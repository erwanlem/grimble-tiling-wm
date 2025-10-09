import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

var executables : Set<string> | null = null;
export var gnomeExecutables : Map<string, Gio.AppInfo> | null = null;

var sourceId : number | null = null;


/** Load executables accessible from path and
 * desktop app names from Shell.AppSystem API
 * 
 * @returns void
 */
export function loadExecutables() {
    let path = GLib.getenv("PATH");
    if (!path)
        return;
    let paths = path?.split(":");

    if (executables === null)
        executables = new Set();
    if (gnomeExecutables === null)
        gnomeExecutables = new Map();

    paths.forEach(el => {
        let dir = Gio.File.new_for_path(el);
        dir.enumerate_children_async(
            'standard::*',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW,
            null,
            (source, result) => {
                try {
                    if (!source)
                        return;
                    let e = source.enumerate_children_finish(result);

                    let file;
                    while ((file = e.next_file(null)) !== null) {
                        let name = file.get_name();
                        if (!executables?.has(name))
                            executables?.add(name);
                    }

                    e.close(null);
                } catch (e) {
                    return;
                }
            }
        );
    });

    if (sourceId !== null)
        GLib.Source.remove(sourceId);

    sourceId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
        Shell.AppSystem.get_default().get_installed().forEach(app => {
            let name = app.get_display_name() ?? app.get_name();
            let exe = app.get_commandline() ?? null;
            if (!gnomeExecutables?.has(name) && exe)
                gnomeExecutables?.set(name.toLowerCase(), app);
        });
        sourceId = null;
        return GLib.SOURCE_REMOVE;
    });
}

/** Returns a list of apps beginning with `word`
 * 
 * @param {string} word 
 * @returns 
 */
export function autocomplete(word : string) : Array<string> {
    word = word.toLowerCase();

    let matches : Array<string> = [];

    gnomeExecutables?.forEach((e, w) => w.startsWith(word) && w !== word && e !== null ? matches.push(w) : -1);    
    executables?.forEach(w => w.startsWith(word) && w !== word ? matches.push(w) : -1);
    
    matches.sort((a, b) => a.length < b.length ? -1 : 1);

    return matches;
}


export function clear() {
    if (sourceId !== null)
        GLib.Source.remove(sourceId);
    sourceId = null;
}

export function destroy() {
    executables = null;
    gnomeExecutables = null;
}