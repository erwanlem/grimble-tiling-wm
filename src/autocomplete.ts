import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const executables : Set<string> = new Set();

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

}


export function autocomplete(word : string) : Array<string> {
    let matches : Array<string> = [];
    executables.forEach(w => w.startsWith(word) && w !== word ? matches.push(w) : -1);
    matches.sort((a, b) => a.length < b.length ? -1 : 1);

    return matches;
}