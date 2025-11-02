import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import St from 'gi://St';

export const ItemListDialog = GObject.registerClass(
class ItemListDialog extends ModalDialog.ModalDialog {
    constructor(items : string[]) {
        super({ styleClass: 'item-list-dialog' });

        const scroll = new St.ScrollView({ style_class: 'dialog-scroll-view' });
        const vbox = new St.BoxLayout({
            vertical: true,
            style_class: 'item-list-box',
            x_expand: true,
        });
        scroll.add_child(vbox);

        items.forEach(i => {
             const row = new St.BoxLayout({
                style_class: 'item-row',
                vertical: false,
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                reactive: true,
                can_focus: true,
                track_hover: true, // allows hover styling
            });

            // Label
            const label = new St.Label({
                text: i,
                x_expand: true,
                x_align: Clutter.ActorAlign.START,
            });
            row.add_child(label);

            const icon = new St.Icon({
                icon_name: 'user-trash-symbolic',
                icon_size: 18,
                style_class: 'item-row-icon',
            });

            // Button
            const actionButton = new St.Button({
                style_class: 'item-row-button',
            });
            actionButton.set_child(icon);

            row.add_child(actionButton);

            // Click handlers
            actionButton.connect('clicked', () => log(`Clicked "Run" on ${i}`));
            row.connect('button-release-event', () => log(`Clicked row: ${i}`));

            vbox.add_child(row);
        });

        this.contentLayout.add_child(scroll);
    }
});