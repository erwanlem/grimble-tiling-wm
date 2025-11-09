import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import St from 'gi://St';

export const ItemListDialog = GObject.registerClass(
class ItemListDialog extends ModalDialog.ModalDialog {

    constructor(items : string[]) {
        super({ styleClass: 'item-list-dialog' });

        const listLayout = new Dialog.ListSection({
            title: 'Environments',
            reactive: true,
            track_hover: true,
            can_focus: true,
        });

        this.contentLayout.add_child(listLayout);

        items.forEach(item => {
            const i = new Dialog.ListSectionItem({});

            const box = new St.BoxLayout({
                style_class: 'dialog-list-section-item',
                vertical: true,
                x_expand: true,
                y_expand: true,
                reactive: true,
                can_focus: true,
                track_hover: true
            });

            box.connect('button-press-event', () => {
                this.close();
                return Clutter.EVENT_STOP;
            });

            const titleLabel = new St.Label({
                text: item,
                style_class: 'item-title',
                x_align: Clutter.ActorAlign.START,
            });

            // const descLabel = new St.Label({
            //     text: 'The first thing I need to do',
            //     style_class: 'item-description',
            //     x_align: Clutter.ActorAlign.START,
            // });

            box.add_child(titleLabel);
            //box.add_child(descLabel);
            i.add_child(box);
            
            listLayout.list.add_child(i);
        });

        // Add buttons at bottom
        this.addButton({
            label: 'Close',
            action: () => this.close(),
            key: Clutter.KEY_Escape,
        });
    }
});