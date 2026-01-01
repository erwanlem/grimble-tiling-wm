import Gio from 'gi://Gio';
import GLib from 'gi://GLib';


/** Launch the given app
 * 
 * @param {string[]} command 
 * @returns 
 */
export function launchApp(command: string[]) {
    try {
        Gio.Subprocess.new(
            command,
            Gio.SubprocessFlags.NONE
        );
        return true;
    } catch (e) {
        console.warn(`Failed launch : ${e}`);
        return false;
    }
}

/** Load the configuration stored at `name`.
 * 
 * @param {string} name configuration file path
 * @param {(a: any) => void} callback a function called when the result is returned
 * @param {() => void} errorCallback function called to handle errors
 * @returns 
 */
export function loadConfiguration(name: string, callback: (a: any) => void, errorCallback: () => void) {
    const f = Gio.File.new_for_path(name);

    f.load_contents_async(null, (file, res) => {
        try {
            let r = file?.load_contents_finish(res);

            if (!r || !r[0] || !r[1].length) {
                errorCallback();
                return;
            }

            const conf = JSON.parse(
                new TextDecoder().decode(r[1])
            );

            callback(conf);
        } catch (e) {
            if (e instanceof Gio.IOErrorEnum ||
                (e as any).matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                errorCallback?.();
            } else {
                logError(e);
            }
        }
    });
}



/** Save the keybinding configuration stored in `obj` in the file `name`.
 * 
 * @param {string} name configuration file name
 * @param {Object} obj Object to save
 */
export function saveConfiguration(name: String, obj: Object) {
    const userPath = GLib.get_user_config_dir();
    const parentPath = GLib.build_filenamev([userPath, '/grimble/config']);
    const parent = Gio.File.new_for_path(parentPath);

    try {
        parent.make_directory_with_parents(null);
    } catch (e: any) {
        if (e.code !== Gio.IOErrorEnum.EXISTS)
            throw e;
    }

    const path = GLib.build_filenamev([parentPath, `/${name}`]);
    const f = Gio.File.new_for_path(path);

    try {
        f.create(Gio.FileCreateFlags.NONE, null);
    } catch (e: any) {
        if (e.code !== Gio.IOErrorEnum.EXISTS)
            throw e;
    }

    const data = new TextEncoder().encode(JSON.stringify(obj));

    f.replace_contents_async(
        data,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (file, res) => {
        try {
            file?.replace_contents_finish(res);
        } catch (e) {
            logError(e);
        }
    }
    );
}