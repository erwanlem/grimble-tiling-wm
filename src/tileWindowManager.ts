import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { Orientation, Tile, TileState } from "./tile.js";
import { Position } from "./position.js";
import * as Resize from "./resize.js";
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import { Monitor } from './monitor.js';
import { launchApp } from './utils.js';
import Shell from 'gi://Shell';
import Pango from 'gi://Pango';
import Clutter from 'gi://Clutter';

import { Button as PanelButton } from 'resource:///org/gnome/shell/ui/panelMenu.js';


export enum Direction {
    North = 1,
    South,
    West,
    East
}


let LOCKED = false;

export class TileWindowManager {
    _wrappedWindows: Map<Meta.Window, [() => void,
        (dir: Meta.MaximizeFlags | null) => void,
        number, number, number, number, number]>;
    _windowCreatedSignal: number;
    _windowGrabSignal: number;

    _extensionObject: Extension | null = null;
    _settings: Gio.Settings | undefined;

    _fullscreenState: boolean = false;

    static rotateEven = [0, 0];

    _focusHistory: Array<Meta.Window>;

    private static monitors: Array<Monitor>;

    _searchContainer: St.Bin | undefined;
    _searchEntry: St.Entry | undefined;
    _searchSuggestion: St.Label | undefined;
    _searchButton : PanelButton | undefined;

    _wasLocked: boolean = false;

    constructor() {
        this._extensionObject = Extension.lookupByUUID('gtile@lmt.github.io');
        this._settings = this._extensionObject?.getSettings();

        TileWindowManager.monitors = new Array(global.display.get_n_monitors());
        for (const [i, value] of TileWindowManager.monitors.entries()) {
            TileWindowManager.monitors[i] = new Monitor(i);
        }

        this._focusHistory = [];
        this._wrappedWindows = new Map();

        this._windowCreatedSignal = 0;
        this._windowGrabSignal = 0;

        if (LOCKED) {
            this._loadAfterSessionLock();
        }

        global.get_window_actors().forEach(
            actor => {
                if (actor.meta_window
                    && actor.meta_window.get_window_type() === Meta.WindowType.NORMAL) {
                    this._addNewWindow(actor.meta_window);
                }
            }
        );

        TileWindowManager.monitors.forEach(el => el.root?.update());

        this._windowCreatedSignal = global.display.connect(
            'window-created',
            (display, obj) => this._onWindowCreated(display, obj)
        );

        this._windowGrabSignal = global.display.connect(
            'grab-op-end',
            (_, window, op) => this._onGrabBegin(window, op)
        );

    }

    public static getMonitors() : Monitor[] {
        return TileWindowManager.monitors;
    }

    public updateMonitors() {
        TileWindowManager.monitors.forEach(el => el.root?.update());
    }

    /**
     * @returns Meta.Window or null
     */
    private getFocusedWindow() {
        if (this._focusHistory.length > 0)
            return this._focusHistory[0];
        else
            return null;
    }
    
    /** We keep track of the focused window using the `focus` signal
     * because it is more reliable than global.display.focusWindow
     * 
     * @param window 
     * @param focused false to remove the focused window
     */
    private updateFocusHistory(window: Meta.Window, focused = true) {
        this._focusHistory = this._focusHistory.filter((w) => w !== window)
        if (focused) this._focusHistory.unshift(window)
    }


    public destroy() {
        global.display.disconnect(this._windowCreatedSignal);
        global.display.disconnect(this._windowGrabSignal);

        this._wrappedWindows.forEach(
            (value, key) => {
                key.minimize = value[0]; key.maximize = value[1];
                key.disconnect(value[2]); key.disconnect(value[3]);
                key.disconnect(value[4]); key.disconnect(value[5]);
                key.disconnect(value[6]);
                this._wrappedWindows.delete(key);
            }
        );
        this._wrappedWindows.clear();
        this.disableSearchEntry();
    }

    
    /** Check if the window is a `valid` window.
     * A `valid` window is a window created by user and 
     * running an app.
     * It is tricky to filter windows correctly. Here we exclude 
     * windows that don't have app id (the id is just the app number).
     * This method must be called when we're sure the window is **fully**
     * created (basically when wait for first-frame signal). Otherwise 
     * we may badly filter some windows.
     * 
     * @param window 
     * @returns boolean
     */
    private _isValidWindow(window: Meta.Window): boolean {
        if (!window)
            return false;

        if (window.get_window_type() !== Meta.WindowType.NORMAL)
            return false;

        let app = Shell.WindowTracker.get_default().get_window_app(window);
        if (!app)
            return false;

        if (app.get_id().startsWith('window:'))
            return false;

        let containsWindow = TileWindowManager.monitors.reduce(
            (acc: boolean, val: Monitor) => val.root ? acc || val.root.contains(window) : acc, false
        );
        if (containsWindow)
            return false;

        return true;
    }



    private _onWindowCreated(_: Meta.Display | null, window: Meta.Window) {
        // console.warn(`Window created ${window.get_title()} wm-class=${window.get_wm_class()} role=${window.get_role()} workspace=${window.get_workspace().index()}`);
        // let app = Shell.WindowTracker.get_default().get_window_app(window);
        // console.warn(`App : ${app.get_id()}`);

        // Wait to be sure window is fully created
        window.get_compositor_private().connect(
            'first-frame',
            () => {
                this._addNewWindow(window);
            }
        );
    }


    /** Connect to signals and remove some functions
     * 
     * @param window 
     */
    public configureWindowSignals(window: Meta.Window) {

        let minimizeSignal = window.connect('notify::minimized', () => {
            if ((window as any).tile.state === TileState.MINIMIZED)
                return;

            if (window.minimized) {
                window.unminimize();
            }
        });
        let maximizeSignal1 = window.connect(
            'notify::maximized-horizontally',
            () => {
                if ((window as any).tile.state === TileState.MAXIMIZED
                    || (window as any).tile.state === TileState.ALONE_MAXIMIZED) {
                    return;
                }

                if (window.maximized_horizontally || window.maximized_vertically) {
                    window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
            }
        );
        let maximizeSignal2 = window.connect(
            'notify::maximized-vertically',
            () => {
                if ((window as any).tile.state === TileState.MAXIMIZED
                    || (window as any).tile.state === TileState.ALONE_MAXIMIZED) {
                    return;
                }

                if (window.maximized_horizontally || window.maximized_vertically) {
                    window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
            }
        );

        let unmanagedSignal = window.connect('unmanaged', () => this._removeWindow(window));

        this._focusHistory.push(window);
        let focusSignal = window.connect(
            'focus',
            () => {
                this.updateFocusHistory(window);
            }
        );

        (window as any)._originalMaximize = window.maximize;
        (window as any)._originalMinimize = window.minimize;

        this._wrappedWindows.set(
            window,
            [window.minimize, window.maximize, minimizeSignal,
                maximizeSignal1, maximizeSignal2, focusSignal, unmanagedSignal]
        );

        window.minimize = () => { };
        window.maximize = () => { };
    }


    private _addNewWindow(window: Meta.Window) {
        // console.warn(`>>> Window created ${window.get_title()} wm-class=${window.get_wm_class()} role=${window.get_role()} workspace=${window.get_workspace().index()}`);
        // let app = Shell.WindowTracker.get_default().get_window_app(window);
        // console.warn(`App : ${app.get_id()} <<<`);

        if (!this._isValidWindow(window))
            return;

        this.configureWindowSignals(window);

        this.updateFocusHistory(window);

        let monitor: Monitor;

        // Select monitor
        if (this._settings?.get_int('monitor-tile-insertion-behavior') == 0) {
            monitor = Monitor.bestFitMonitor(TileWindowManager.monitors);
        } else {
            let focusWindow = this.getFocusedWindow();
            if (focusWindow) {
                let tile: Tile = (focusWindow as any).tile;
                monitor = TileWindowManager.monitors[tile.monitor];
            } else {
                monitor = Monitor.bestFitMonitor(TileWindowManager.monitors);
            }
        }

        // Selected monitor index
        let index = monitor.index;

        // Now insert tile on selected monitor
        if (monitor.size() === 0) {
            let tile = Tile.createTileLeaf(window, new Position(1.0, 0, 0, 0, 0), index);

            (window as any).tile = tile;

            TileWindowManager.monitors[index].root = tile;            
            TileWindowManager.monitors[index].root?.update();
        } else {
            if (this._settings?.get_int('tile-insertion-behavior') == 0) {
                TileWindowManager.monitors[index].root?.addWindowOnBlock(window);
            } else {
                let focusWindow = this.getFocusedWindow();
                if (focusWindow) {
                    let tile: Tile = (focusWindow as any).tile;
                    tile.addWindowOnBlock(window);
                } else {
                    TileWindowManager.monitors[index].root?.addWindowOnBlock(window);
                }
            }

            if (this._fullscreenState) {
                (window as any).tile.state = TileState.MINIMIZED;
            }

            TileWindowManager.monitors[index].root?.update();
        }
    }


    private _removeWindow(window: Meta.Window) {
        this.updateFocusHistory(window, false);

        // get Tile from window
        let tile: Tile = (window as any).tile;

        // Not found
        if (!tile) {
            console.warn("_removeWindow : tile not found");
            return;
        }

        let m = tile.monitor;
        if (tile.removeTile() === null)
            TileWindowManager.monitors[m].root = null;
        else
            TileWindowManager.monitors[m].root?.update();
    }


    private _onGrabBegin(window: Meta.Window, op: Meta.GrabOp) {
        if (!window) return;

        let tile = (window as any).tile;

        if (!tile)
            return;

        let m = tile.monitor;
        if (op === Meta.GrabOp.MOVING) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                TileWindowManager.monitors[m].root?.update();
                return GLib.SOURCE_REMOVE;
            });

        } else if (op === Meta.GrabOp.RESIZING_E) {
            let rect = window.get_frame_rect();

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                Resize.resizeE(tile, rect);
                return GLib.SOURCE_REMOVE;
            });

        } else if (op === Meta.GrabOp.RESIZING_W) {
            let rect = window.get_frame_rect();

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                Resize.resizeW(tile, rect);
                return GLib.SOURCE_REMOVE;
            });
        } else if (op === Meta.GrabOp.RESIZING_N) {
            let rect = window.get_frame_rect();

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                Resize.resizeN(tile, rect);
                return GLib.SOURCE_REMOVE;
            });
        } else if (op === Meta.GrabOp.RESIZING_S) {
            let rect = window.get_frame_rect();

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                Resize.resizeS(tile, rect);
                return GLib.SOURCE_REMOVE;
            });
        }
    }


    /** Clock wise windows rotation. 
     * Rotates the parent tile (if existing).
     * 
     * @param window 
     * @returns 
     */
    public rotateWindow(window: Meta.Window) {
        let tile: Tile | undefined = (window as any).tile;

        if (!tile)
            return;

        let parent = tile.parent;

        if (!parent)
            return;

        let newPositions: Array<Position>;
        if (parent.orientation === Orientation.Horizontal) {
            newPositions = parent.position.split(Orientation.Vertical);
            if (parent.child1 && parent.child2) {
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[0] == 0 ? 0 : 1]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[0] == 0 ? 1 : 0]);
                TileWindowManager.rotateEven[0] = (TileWindowManager.rotateEven[0] + 1) % 2;
                parent.update();
            } else {
                return;
            }
            parent.orientation = Orientation.Vertical;
        } else if (parent.orientation === Orientation.Vertical) {
            newPositions = parent.position.split(Orientation.Horizontal);
            if (parent.child1 && parent.child2) {
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[1] == 0 ? 1 : 0]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[1] == 0 ? 0 : 1]);
                TileWindowManager.rotateEven[1] = (TileWindowManager.rotateEven[1] + 1) % 2;
                parent.update();
            } else {
                return;
            }
            parent.orientation = Orientation.Horizontal;
        } else {
            return;
        }
    }


    /** Maximize the currently focused window.
     * Others windows are reduced using tile specific state.
     * 
     * @param window 
     * @returns 
     */
    public maximizeTile(window: Meta.Window) {
        let tile: Tile | undefined = (window as any).tile;
        if (!tile)
            return;

        let m = tile.monitor;

        if (this._fullscreenState) {
            this._fullscreenState = false;

            TileWindowManager.monitors[m].root?.forEach(el => {
                el.state = TileState.DEFAULT;
                if (el.id === tile.id) {
                } else {
                    el.window?.unminimize();
                }
            });
        } else {
            this._fullscreenState = true;

            TileWindowManager.monitors[m].root?.forEach(el => {
                if (el.id === tile.id) {
                    el.state = TileState.MAXIMIZED;
                } else {
                    el.state = TileState.MINIMIZED;
                }
            });
        }

        TileWindowManager.monitors[m].root?.update();
    }



    public createSearchBar() {
        if (this._searchButton) {
            this.disableSearchEntry();
            this._searchButton = undefined;
        }

        this._searchButton = new PanelButton(0.0, 'searchEntry', false);

        this._searchContainer = new St.Bin({
            x_expand: true,
        });

        this._searchEntry = new St.Entry({
            style_class: 'search-entry',
            can_focus: true,
            hint_text: 'Type to search…',
            track_hover: true,
            x_expand: true,
        });

        // this._searchSuggestion = new St.Label({
        //     text: 'hello',
        //     style: 'color: rgba(150,150,150,0.6);',
        //     x_align: Clutter.ActorAlign.START,
        //     y_align: Clutter.ActorAlign.CENTER,
        //     x_expand: true,
        //     translation_x: 4,
        // });


        this._searchEntry.clutter_text.connect('notify::mapped', (actor) => {
            if (actor.mapped)
                actor.grab_key_focus();
        });

        //this._searchContainer.add_child(this._searchSuggestion);
        this._searchContainer.add_child(this._searchEntry);


        // this._searchEntry.clutter_text.connect('text-changed', (actor) => {
        //     let current = actor.get_text();
        //     let candidates = ["firefox", "code", "gnome-extensions", "gnome-terminal"];

        //     let match = candidates.find(w => w.startsWith(current) && w !== current);

        //     if (!(current == "") && match && this._searchSuggestion) {
        //         this._searchSuggestion.set_text(match);

        //         if (this._searchEntry) {
        //             let context = this._searchEntry.clutter_text.get_pango_context();
        //             let layout = Pango.Layout.new(context);
        //             layout.set_text(current, -1);

        //             let font_description = this._searchEntry.clutter_text.get_font_description();
        //             if (font_description)
        //                 layout.set_font_description(font_description);
                    
        //             let [strong] = layout.get_cursor_pos(current.length);
        //             if (strong) {
        //                 let cursorX = strong.x / Pango.SCALE;

        //                 // Move suggestion just after typed chars
        //                 this._searchSuggestion.set_translation(cursorX, 0, 0);
        //             }

        //         }
        //     } else if (this._searchSuggestion) {
        //         this._searchSuggestion.set_text('');
        //     }
        // });

        this._searchEntry.clutter_text.connect('activate', (actor) => {
            let query = actor.get_text().trim().toLowerCase();

            if (query === "" || launchApp([query])) {
                this.disableSearchEntry();
            } else {
                actor.set_text("");
                this._searchEntry?.set_style("border: 2px solid red;");
            }

            console.warn(`User pressed Enter with: ${query}`);
        });

        this._searchButton.add_child(this._searchContainer);

        Main.panel.addToStatusArea('SearchEntry', this._searchButton, 0, 'left');
    }


    public refresh() {
        TileWindowManager.monitors.forEach(el => el.root ? el.root.update() : null);
    }


    public disableSearchEntry() {
        if (this._searchButton) {
            this._searchContainer?.destroy();
            this._searchContainer = undefined;
            this._searchEntry?.destroy();
            this._searchEntry = undefined;
            this._searchButton.destroy();
            this._searchButton = undefined;
            this._searchSuggestion?.destroy();
            this._searchSuggestion = undefined;
        }
    }


    /** Extension is disabled on screen lock.
     * We save the state of the Monitors before we quit.
     * 
     * @returns 
     */
    public _saveBeforeSessionLock() {
        if (!Main.sessionMode.isLocked)
            return;

        LOCKED = true;

        const userPath = GLib.get_user_config_dir();
        const parentPath = GLib.build_filenamev([userPath, '/gtile']);
        const parent = Gio.File.new_for_path(parentPath);

        try {
            parent.make_directory_with_parents(null);
        } catch (e: any) {
            if (e.code !== Gio.IOErrorEnum.EXISTS)
                throw e;
        }

        const path = GLib.build_filenamev([parentPath, '/tilingWmSession2.json']);
        const file = Gio.File.new_for_path(path);

        try {
            file.create(Gio.FileCreateFlags.NONE, null);
        } catch (e: any) {
            if (e.code !== Gio.IOErrorEnum.EXISTS)
                throw e;
        }

        file.replace_contents(
            JSON.stringify({
                windows: TileWindowManager.monitors
            }, (key, value) => {
                if (value instanceof Meta.Window)
                    return value.get_id();
                else if (key === "_parent") // remove cyclic references
                    return undefined;
                else
                    return value;
            }),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
    }


    public _loadAfterSessionLock() {
        if (!LOCKED)
            return;

        LOCKED = false;

        const userPath = GLib.get_user_config_dir();
        const path = GLib.build_filenamev([userPath, '/gtile/tilingWmSession2.json']);
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null))
            return;

        try {
            file.create(Gio.FileCreateFlags.NONE, null);
        } catch (e: any) {
            if (e.code !== Gio.IOErrorEnum.EXISTS)
                throw e;
        }

        const [success, contents] = file.load_contents(null);
        if (!success || !contents.length)
            return;

        const openWindows = global.display.list_all_windows();

        const states = JSON.parse(new TextDecoder().decode(contents),
            (key, value) => key === "_window" && typeof value === "number"
                ? openWindows.find((val: Meta.Window) => val.get_id() === value)
                : value
        );

        TileWindowManager.monitors = states.windows;
        TileWindowManager.monitors.forEach((value, index, array) => {
            // We need to rebuild correct types from objects
            array[index] = Monitor.fromObject(value);
            array[index].root?.forEach(el => el.window ? this.configureWindowSignals(el.window) : null);
        });
    }



    public moveTile(dir : Direction) {
        let window : Meta.Window | null = this.getFocusedWindow();
        if (!window)
            return;
        
        let tile : Tile = (window as any).tile;
        if (!tile.window)
            return;
        
        let exchangeTile = TileWindowManager.monitors[tile.monitor].closestTile(tile, dir);
        if (!exchangeTile || !exchangeTile.window)
            return;

        let tmpWindow = exchangeTile.window;
        exchangeTile.window = tile.window;
        tile.window = tmpWindow;

        (tile.window as any).tile = tile;
        (exchangeTile.window as any).tile = exchangeTile;
        
        TileWindowManager.monitors[tile.monitor].root?.update();
    }
}