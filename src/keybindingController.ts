import GObject from 'gi://GObject';

export const KeybindingController = GObject.registerClass({
    Signals: {
        'keybinding-changed': {
            param_types: [GObject.TYPE_STRING],
        },
    },
}, class KeybindingController extends GObject.Object {
    update(key : any) {
        this.emit('keybinding-changed', key);
    }
});

var keybindingController : any = null;

export function getKeybindingController() {
    if (keybindingController === null)
        keybindingController = new KeybindingController();
    return keybindingController;
}


export function destroyController() {
    keybindingController = null;
}