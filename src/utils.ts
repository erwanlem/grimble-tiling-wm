import Gio from 'gi://Gio';


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