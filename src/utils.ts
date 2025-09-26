import Gio from 'gi://Gio';



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