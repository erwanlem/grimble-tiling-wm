import Gio from 'gi://Gio';
import GLib from 'gi://GLib';


/** Launch the given app
 * 
 * @param {string[]} command 
 * @returns 
 */
export function launchApp(command : string[]) {
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
 * @returns 
 */
export function loadConfiguration(name : string) {
    const file = Gio.File.new_for_path(name);
    if (!file.query_exists(null))
        return null;

    const [success, contents] = file.load_contents(null);
    if (!success || !contents.length)
        return null;

    const conf = JSON.parse(new TextDecoder().decode(contents));

    return conf;
}



/** Save the keybinding configuration stored in `obj` in the file `name`.
 * 
 * @param {string} name configuration file name
 * @param {Object} obj Object to save
 */
export function saveConfiguration(name : String, obj : Object) {
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
    const file = Gio.File.new_for_path(path);

    try {
        file.create(Gio.FileCreateFlags.NONE, null);
    } catch (e: any) {
        if (e.code !== Gio.IOErrorEnum.EXISTS)
            throw e;
    }

    file.replace_contents(
        JSON.stringify(obj),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
    );
}