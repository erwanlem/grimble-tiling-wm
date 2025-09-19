// gjs (ES modules, GNOME 45+)
import St from 'gi://St';
import Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import Clutter from 'gi://Clutter';
import { launchApp } from './utils.js';

export class ModalSearchEntry extends ModalDialog.ModalDialog {
    _entry: St.Entry;
    _kpId: number;

    constructor(title: string = 'Type something', placeholder: string = '…') {
        super({ styleClass: 'prompt-dialog' });

        const box = new St.BoxLayout({ vertical: true, style_class: 'entry-dialog-content' });
        box.add_child(new St.Label({ text: title }));

        this._entry = new St.Entry({
            can_focus: true,
            hint_text: placeholder,
            style_class: 'search-entry',
            x_expand: true,
        });
        box.add_child(this._entry);

        // add content & buttons
        this.contentLayout.add_child(box);
        this.setButtons([
            { label: 'Cancel', action: () => this.close() },
            {
                label: 'OK',
                default: true,
                action: () => {
                    launchApp([this._entry.get_text()]);
                    this.close();
                },
            },
        ]);

        // handle Enter/Esc
        this._kpId = this._entry.clutter_text.connect('key-press-event', (_a, ev) => {
            const sym = ev.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                launchApp([this._entry.get_text()]);
                this.close();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    openWithFocus() {
        this.open();
        this._entry.grab_key_focus();
    }

    vfunc_destroy() {
        if (this._kpId) this._entry.clutter_text.disconnect(this._kpId);
        super.vfunc_destroy();
    }
}
