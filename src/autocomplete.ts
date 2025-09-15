import Shell from 'gi://Shell';
import GLib from 'gi://GLib';


function load_executables() {
    let path = GLib.getenv("PATH");
    if (!path)
        return;
    //console.warn(`PATH=${path}`);
    let paths = path?.split(":");
}


export function autocomplete(word : string) : Array<string> {
    load_executables();
    // const appIndex = Shell.AppSystem.get_default().get_installed();
    // let candidates : Set<string> = new Set();
    // appIndex.forEach(appInfo => {
    //     let msg = `Executable : ${appInfo.get_executable()}\nName : ${appInfo.get_name()}\n
    //     Commandline : ${appInfo.get_commandline()}\nDisplay name : ${appInfo.get_display_name()}\n
    //     Id : ${appInfo.get_id()}\nDescription : ${appInfo.get_description()}\n\n`;
    //     console.warn(msg);
    //     if (appInfo.get_executable()) candidates.add(appInfo.get_executable());
    //     if (appInfo.get_name() && !candidates.has(appInfo.get_name())) candidates.add(appInfo.get_name());
    //     if (!candidates.has(appInfo.get_commandline() ?? "")) candidates.add(appInfo.get_commandline() ?? "");
    //     if (!candidates.has(appInfo.get_display_name() ?? "")) candidates.add(appInfo.get_display_name() ?? "");
    // });

    // let matches : Array<string> = [];
    // candidates.forEach(w => w.startsWith(word) && w !== word ? matches.push(w) : -1);

    return [];
}