import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import { Button as PanelButton } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import Clutter from 'gi://Clutter';
import { gnomeExecutables, autocomplete } from './autocomplete.js';
import { launchApp } from './utils.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export class TopBarSearchEntry {
    _searchButton : PanelButton | undefined;
    _searchContainer : St.Bin | undefined;
    _searchEntry : St.Entry | undefined;
    _searchSuggestion : St.Label | undefined;
    _alive : boolean;

    constructor() {
        this._alive = true;
        this._searchButton = new PanelButton(0.0, 'searchEntry', false);

        this._searchContainer = new St.Bin({
            x_expand: true,
        });

        this._searchEntry = new St.Entry({
            style_class: 'custom-search-entry',
            can_focus: true,
            hint_text: 'Type to search…',
            track_hover: true,
            x_expand: true,
        });

        this._searchSuggestion = new St.Label({
            style_class: 'suggestion',
            text: '',
            x_expand: true,
        });

        this._searchEntry.clutter_text.connect('notify::mapped', (actor : any) => {
            if (actor.mapped)
                actor.grab_key_focus();
        });

        this._searchContainer.add_child(this._searchSuggestion);
        this._searchContainer.add_child(this._searchEntry);


        this._searchEntry.clutter_text.connect('text-changed', (actor : any) => {
            let current = actor.get_text();

            if (current.length > 1 && this._searchSuggestion) {
                let matches = autocomplete(current);
                if (matches.length > 0 && this._searchEntry) {
                    let match = matches[0];
                    const ct = this._searchEntry.get_clutter_text();
                    const layout = ct.get_layout();
                    const [textW] = layout.get_pixel_size();

                    const themeNode = this._searchEntry.get_theme_node();
                    const leftPad  = themeNode.get_padding(St.Side.LEFT);

                    const x = leftPad + textW;

                    this._searchSuggestion.set_style(`color: rgba(255,255,255,0.35); margin-left: ${x+4}px;`);
                    this._searchSuggestion.set_text(match.slice(current.length));
                } else {
                    this._searchSuggestion.set_text('');
                }
            } else if (this._searchSuggestion) {
                this._searchSuggestion.set_text('');
            }
        });

        let completeText = () => {
            const typed = this._searchEntry?.get_text();
            const ct = this._searchEntry?.get_clutter_text();
            if (!typed || !ct)
                return;
            let full = typed + this._searchSuggestion?.get_text();
            this._searchEntry?.set_text(full);
            ct.set_cursor_position(full.length);
            this._searchSuggestion?.set_text('');
        };

        this._searchEntry.clutter_text.connect('key-press-event', (ct : any, event : any) => {
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_KP_Right || key === Clutter.KEY_Right) {
                // Only accept if cursor is at end and a suggestion exists
                const typed = this._searchEntry?.get_text();
                const pos = ct.get_cursor_position();
                if (typed) {
                    completeText();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._searchEntry.connect('captured-event', (actor : any, event : any) => {
            if (event.type() !== Clutter.EventType.KEY_PRESS)
                return Clutter.EVENT_PROPAGATE;

            const sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Tab || sym === Clutter.KEY_ISO_Left_Tab) {
                completeText();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._searchEntry.clutter_text.connect('activate', (actor : any) => {
            let query = actor.get_text().trim().toLowerCase();
            
            if (query === "") {
                this.destroy();
            } else if (gnomeExecutables.get(query)) {
                gnomeExecutables.get(query)?.launch([], null);
                this.destroy();
            } else if (launchApp([query])) {
                this.destroy();
            } else {
                actor.set_text("");
                this._searchEntry?.set_style("border: 2px solid red;");
            }
        });

        this._searchButton.add_child(this._searchContainer);

        let extensionObject = Extension.lookupByUUID('grimble@lmt.github.io');
        let positionInt = extensionObject?.getSettings().get_int('search-entry-position');
        let position = positionInt === 0 ? 'left' : positionInt === 1 ? 'center' : 'right';
        Main.panel.addToStatusArea('SearchEntry', this._searchButton, 0, position);
    }

    public isAlive() {
        return this._alive;
    }


    public destroy() {
        this._alive = false;
        if (this._searchButton) {
            this._searchButton?.destroy();
            this._searchContainer = undefined;
            this._searchEntry = undefined;
            this._searchButton = undefined;
            this._searchSuggestion = undefined;
        }
    }

}