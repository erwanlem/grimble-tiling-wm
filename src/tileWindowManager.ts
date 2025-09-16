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
import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';
import { autocomplete } from './autocomplete.js';

import { Button as PanelButton } from 'resource:///org/gnome/shell/ui/panelMenu.js';

export enum Direction {
    North = 1,
    South,
    West,
    East
}


const RESIZE_GAP = 10;
let LOCKED = false;

export class TileWindowManager {

    /**************************************************/
    // Store all signals to be restored when extension is disabled
    _wrappedWindows: Map<Meta.Window, [() => void,
        (dir: Meta.MaximizeFlags | null) => void,
        number, number, number, number, number, number, number]>;

    _windowCreatedSignal: number;
    _windowGrabSignal: number;
    _workareaChangedSignal : number;
    _workspaceAddedSignal : number;
    _enteredMonitorSignal : number;
    _grabBeginSignal : number;
    /**************************************************/
    _settings: Gio.Settings | undefined;

    _userResize : Set<Meta.Window>;

    // Alternate windows rotation
    static rotateEven = [0, 0];

    _focusHistory: Array<Meta.Window>;

    // Search bar widgets
    _searchContainer: St.Bin | undefined;
    _searchEntry: St.Entry | undefined;
    _searchSuggestion: St.Label | undefined;
    _searchButton : PanelButton | undefined;

    // Tiles structures
    private static _workspaces : Map<number, Array<Monitor>> = new Map();


    constructor() {
        let _extensionObject = Extension.lookupByUUID('gtile@lmt.github.io');
        this._settings = _extensionObject?.getSettings();

        for (let i = 0; i < global.workspace_manager.n_workspaces; i++) {
            let _monitors = new Array(global.display.get_n_monitors());
            for (const [i, value] of _monitors.entries()) {
                _monitors[i] = new Monitor(i);
            }
            TileWindowManager._workspaces.set(i, _monitors);
        }

        this._focusHistory = [];
        this._wrappedWindows = new Map();
        this._userResize = new Set();

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

        this.updateMonitors();

        this._windowCreatedSignal = global.display.connect(
            'window-created',
            (display, obj) => this._onWindowCreated(display, obj)
        );

        this._workareaChangedSignal = global.display.connect(
            'workareas-changed', 
            () => this.updateMonitors()
        );

        this._enteredMonitorSignal = global.display.connect(
            'window-entered-monitor', 
            (_, __, window) => {
                let tile = (window as any).tile;
                if (tile)
                    TileWindowManager.getMonitors()[tile.monitor].root?.update();
        });

        this._grabBeginSignal = global.display.connect('grab-op-begin', (_, w) => this._userResize.add(w));

        this._windowGrabSignal = global.display.connect(
            'grab-op-end',
            (_, window, op) => {
                this._onGrab(window, op);
                this._userResize.delete(window);
            }
        );

        this._workspaceAddedSignal = global.workspace_manager.connect('workspace-added', (_, index) => {
            this._onWorkspaceCreated(index);
        });
    }



    public static getMonitors() : Monitor[] {
        let wk = TileWindowManager._workspaces.get(global.workspace_manager.get_active_workspace_index());
        if (wk)
            return wk;
        else
            return [];
    }


    /**
     * Refresh **ALL** existing tiles.
     */
    public updateMonitors() {
        TileWindowManager._workspaces.forEach((value, key) => {
            value.forEach(el => el.root?.update());
        });
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
        global.display.disconnect(this._workspaceAddedSignal);
        global.display.disconnect(this._workspaceAddedSignal);
        global.display.disconnect(this._enteredMonitorSignal);
        global.display.disconnect(this._grabBeginSignal);

        this._wrappedWindows.forEach(
            (value, key) => {
                key.minimize = value[0]; key.maximize = value[1];
                key.disconnect(value[2]); key.disconnect(value[3]);
                key.disconnect(value[4]); key.disconnect(value[5]);
                key.disconnect(value[6]); key.disconnect(value[7]);
                key.disconnect(value[8]);
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


        for (var [key, value] of TileWindowManager._workspaces) {
            let containsWindow = value.reduce(
                (acc: boolean, val: Monitor) => val.root ? acc || val.root.contains(window) : acc, false
            );
            if (containsWindow)
                return false;
        }

        return true;
    }


    private _onWorkspaceCreated(index : number) {

        let _monitors = new Array(global.display.get_n_monitors());
        for (const [i, value] of _monitors.entries()) {
            _monitors[i] = new Monitor(i);
        }

        if (!TileWindowManager._workspaces.has(index))
            TileWindowManager._workspaces.set(index, _monitors);

    } 



    private _onWindowCreated(_: Meta.Display | null, window: Meta.Window) {

        // Wait for first frame to be sure window is fully created
        window.get_compositor_private().connect(
            'first-frame',
            () => {
                this._addNewWindow(window);
            }
        );
    }



    private _windowWorkspaceChanged(window : Meta.Window) {
        let tile : Tile = (window as any).tile;
        if (tile) {
            if (tile.workspace !== window.get_workspace()?.index()) {
                window.change_workspace_by_index(tile.workspace, false);
            }
        }
    }




    /** Connect to signals and remove some functions
     * 
     * @param window 
     */
    private configureWindowSignals(window: Meta.Window) {

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

        let workspaceChangedSignal = window.connect('workspace-changed', 
            (window) => this._windowWorkspaceChanged(window)
        );

        let sizeChangedSignal = window.connect('size-changed', (window) => {
            let tile : Tile = (window as any).tile;
            if (!this._userResize.has(window) 
                && (tile.position.width !== window.get_frame_rect().width 
                || tile.position.height !== window.get_frame_rect().height))
                tile.update();
        });

        (window as any)._originalMaximize = window.maximize;
        (window as any)._originalMinimize = window.minimize;

        this._wrappedWindows.set(
            window,
            [window.minimize, window.maximize, minimizeSignal,
                maximizeSignal1, maximizeSignal2, focusSignal, 
                unmanagedSignal, workspaceChangedSignal, sizeChangedSignal]
        );

        window.minimize = () => { };
        window.maximize = () => { };
    }


    private _addNewWindow(window: Meta.Window) {
        if (!this._isValidWindow(window))
            return;

        this.configureWindowSignals(window);

        this.updateFocusHistory(window);

        this._insertWindow(window); 
    }

    private _insertWindow(window: Meta.Window, workspace : number | null = null) {
        let _monitors = TileWindowManager._workspaces.get(workspace ? workspace : window.get_workspace().index());
        if (!_monitors)
            return;

        let selected_monitor: Monitor;

        // Select monitor
        if (this._settings?.get_int('monitor-tile-insertion-behavior') == 0) {
            selected_monitor = Monitor.bestFitMonitor(_monitors);
        } else {
            let focusWindow = global.display.focus_window;
            if (focusWindow) {
                let tile: Tile = (focusWindow as any).tile;
                selected_monitor = _monitors[tile.monitor];
            } else {
                selected_monitor = Monitor.bestFitMonitor(_monitors);
            }
        }

        // Selected monitor index
        let index = selected_monitor.index;

        // Now insert tile on selected monitor
        if (selected_monitor.size() === 0) {
            let tile = Tile.createTileLeaf(window, new Position(1.0, 0, 0, 0, 0), index);
            tile.workspace = window.get_workspace().index();

            (window as any).tile = tile;

            _monitors[index].root = tile;            
            _monitors[index].root?.update();
        } else {
            if (this._settings?.get_int('tile-insertion-behavior') == 0) {
                _monitors[index].root?.addWindowOnBlock(window);
            } else {
                let focusWindow = global.display.focus_window;
                if (focusWindow) {
                    let tile: Tile = (focusWindow as any).tile;
                    tile.addWindowOnBlock(window);
                } else {
                    _monitors[index].root?.addWindowOnBlock(window);
                }
            }
            (window as any).tile.workspace = window.get_workspace().index();

            if (_monitors[index].fullscreen) {
                (window as any).tile.state = TileState.MINIMIZED;
            }

            _monitors[index].root?.update();
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
        if (TileWindowManager.getMonitors()[m].fullscreen) {
            TileWindowManager.getMonitors()[m].fullscreen = false;

            TileWindowManager.getMonitors()[m].root?.forEach(el => {
                el.state = TileState.DEFAULT;
                el.window?.unminimize();
            });
        }

        if (tile.removeTile() === null)
            TileWindowManager.getMonitors()[m].root = null;
        else
            TileWindowManager.getMonitors()[m].root?.update();
    }



    private _onGrab(window: Meta.Window, op: Meta.GrabOp) {
        if (!window) return;

        let tile : Tile = (window as any).tile;

        if (!tile)
            return;

        let m = tile.monitor;
        let rect : Mtk.Rectangle;
        switch (op) {
            case Meta.GrabOp.MOVING:
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    TileWindowManager.getMonitors()[m].root?.update();
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_E:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeE(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_W:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeW(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_N:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_S:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;
            
            case Meta.GrabOp.RESIZING_NE:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    Resize.resizeE(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_NW:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    Resize.resizeW(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_SE:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    Resize.resizeE(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_SW:
                rect = window.get_frame_rect();

                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    Resize.resizeW(tile, rect);
                    return GLib.SOURCE_REMOVE;
                });
                break;

            default:
                break;
        }

    }



    /** Resize operation with keyboard. This operation is 
     * different from the one operated with the mouse (grab operation)
     * because we handle left/right resize differently.
     * 
     * @param op 
     * @returns void
     */
    public resizeFocusedWindow(op : Meta.GrabOp) {
        let window = global.display.focusWindow;
        if (!window)
            return;

        let tile = (window as any).tile;

        if (op === Meta.GrabOp.RESIZING_E) {
            if (tile.adjacents[1]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width + RESIZE_GAP,
                    height: tile.position.height
                });
                Resize.resizeE(tile, r);
            } else if (tile.adjacents[0]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x + RESIZE_GAP, 
                    y: tile.position.y,
                    width: tile.position.width - RESIZE_GAP,
                    height: tile.position.height
                });
                Resize.resizeW(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_W) {            
            if (tile.adjacents[0]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x - RESIZE_GAP, 
                    y: tile.position.y,
                    width: tile.position.width + RESIZE_GAP,
                    height: tile.position.height
                });
                Resize.resizeW(tile, r);
            } else if (tile.adjacents[1]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width - RESIZE_GAP,
                    height: tile.position.height
                });
                Resize.resizeE(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_N) {
            if (tile.adjacents[2]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y - RESIZE_GAP,
                    width: tile.position.width,
                    height: tile.position.height + RESIZE_GAP
                });
                Resize.resizeN(tile, r);
            } else if (tile.adjacents[3]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width,
                    height: tile.position.height - RESIZE_GAP
                });
                Resize.resizeS(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_S) {
            if (tile.adjacents[3]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width,
                    height: tile.position.height + RESIZE_GAP
                });
                Resize.resizeS(tile, r);
            } else if (tile.adjacents[2]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y + RESIZE_GAP,
                    width: tile.position.width,
                    height: tile.position.height - RESIZE_GAP
                });
                Resize.resizeN(tile, r);
            }
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
                newPositions[TileWindowManager.rotateEven[0] == 0 ? 0 : 1].splitProportion = parent.child1.position.splitProportion;
                newPositions[TileWindowManager.rotateEven[0] == 0 ? 1 : 0].splitProportion = parent.child2.position.splitProportion;
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[0] == 0 ? 0 : 1]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[0] == 0 ? 1 : 0]);
                parent.forEach(el => el.findAdjacents());
                TileWindowManager.rotateEven[0] = (TileWindowManager.rotateEven[0] + 1) % 2;
                parent.update();
            } else {
                return;
            }
            parent.orientation = Orientation.Vertical;
        } else if (parent.orientation === Orientation.Vertical) {
            newPositions = parent.position.split(Orientation.Horizontal);
            if (parent.child1 && parent.child2) {
                newPositions[TileWindowManager.rotateEven[1] == 0 ? 1 : 0].splitProportion = parent.child1.position.splitProportion;
                newPositions[TileWindowManager.rotateEven[1] == 0 ? 0 : 1].splitProportion = parent.child2.position.splitProportion;
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[1] == 0 ? 1 : 0]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[1] == 0 ? 0 : 1]);
                parent.forEach(el => el.findAdjacents());
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

        if (TileWindowManager.getMonitors()[tile.monitor].fullscreen) {
            TileWindowManager.getMonitors()[tile.monitor].fullscreen = false;

            TileWindowManager.getMonitors()[m].root?.forEach(el => {
                el.state = TileState.DEFAULT;
                if (el.id !== tile.id) {
                    el.window?.unminimize();
                }
            });
        } else {
            TileWindowManager.getMonitors()[tile.monitor].fullscreen = true;

            TileWindowManager.getMonitors()[m].root?.forEach(el => {
                if (el.id === tile.id) {
                    el.state = TileState.MAXIMIZED;
                } else {
                    el.state = TileState.MINIMIZED;
                }
            });
        }

        TileWindowManager.getMonitors()[m].root?.update();
    }



    public moveTile(dir : Direction) {
        let window : Meta.Window | null = this.getFocusedWindow();
        if (!window)
            return;
        
        let tile : Tile = (window as any).tile;
        if (!tile.window)
            return;

        let exchangeTile = TileWindowManager.getMonitors()[tile.monitor].closestTile(tile, dir);
        if (!exchangeTile || !exchangeTile.window)
            return;

        let tmpWindow = exchangeTile.window;
        exchangeTile.window = tile.window;
        tile.window = tmpWindow;

        (tile.window as any).tile = tile;
        (exchangeTile.window as any).tile = exchangeTile;
        
        TileWindowManager.getMonitors()[tile.monitor].root?.update();
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

        this._searchSuggestion = new St.Label({
            text: '',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        this._searchEntry.clutter_text.connect('notify::mapped', (actor) => {
            if (actor.mapped)
                actor.grab_key_focus();
        });

        this._searchContainer.add_child(this._searchSuggestion);
        this._searchContainer.add_child(this._searchEntry);


        this._searchEntry.clutter_text.connect('text-changed', (actor) => {
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

        this._searchEntry.clutter_text.connect('key-press-event', (ct, event) => {
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

        this._searchEntry.connect('captured-event', (actor, event) => {
            if (event.type() !== Clutter.EventType.KEY_PRESS)
                return Clutter.EVENT_PROPAGATE;

            const sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Tab || sym === Clutter.KEY_ISO_Left_Tab) {
                completeText();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._searchEntry.clutter_text.connect('activate', (actor) => {
            let query = actor.get_text().trim().toLowerCase();

            if (query === "" || launchApp([query])) {
                this.disableSearchEntry();
            } else {
                actor.set_text("");
                this._searchEntry?.set_style("border: 2px solid red;");
            }

            //console.warn(`User pressed Enter with: ${query}`);
        });

        this._searchButton.add_child(this._searchContainer);

        Main.panel.addToStatusArea('SearchEntry', this._searchButton, 0, 'left');
    }


    public refresh() {
        TileWindowManager.getMonitors().forEach(el => el.root ? el.root.update() : null);
    }



    public disableSearchEntry() {
        if (this._searchButton) {
            this._searchContainer?.destroy();
            this._searchContainer = undefined;
            this._searchEntry = undefined;
            this._searchButton = undefined;
            this._searchSuggestion = undefined;
        }
    }



    public moveToWorkspace(next : boolean) {
        let window = global.display.get_focus_window();
        let tile : Tile = (window as any).tile;
        let current = tile.workspace;
        if (next) {
            if (current < global.workspaceManager.get_n_workspaces()-1) {
                tile.workspace = current + 1;
                window.change_workspace_by_index(tile.workspace, false);
                this._removeWindow(window);
                this._insertWindow(window, current+1);
            }
        } else {
            if (current > 0) {
                tile.workspace = current - 1;
                window.change_workspace_by_index(tile.workspace, false);
                this._removeWindow(window);
                this._insertWindow(window, current-1);
            }
        }
    }


    public moveToNextMonitor() {
        let window = global.display.get_focus_window();
        this._removeWindow(window);
        
        let tile : Tile = (window as any).tile;
        let monitors = TileWindowManager.getMonitors();
        let newMonitorIndex = (tile.monitor + 1) % monitors.length;
        let newMonitor = monitors[newMonitorIndex];
        if (newMonitor.size() === 0) {
            let tile = Tile.createTileLeaf(window, new Position(1.0, 0, 0, 0, 0), newMonitorIndex);
            tile.workspace = window.get_workspace().index();
            (window as any).tile = tile;

            newMonitor.root = tile;            
            newMonitor.root?.update();
        } else {
            // Easier to create a new tile for insertion
            newMonitor.root?.addWindowOnBlock(window);
            (window as any).tile.workspace = window.get_workspace().index();

            if (newMonitor.fullscreen) {
                (window as any).tile.state = TileState.MINIMIZED;
            }

            newMonitor.root?.update();
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
                windows: Array.from(TileWindowManager._workspaces.entries())
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
        
        let map : Map<number, Monitor[]> = new Map(states.windows);
        map.forEach((mapValue, mapKey, map) => {
            mapValue.forEach((value, index, array) => {
                // We need to rebuild correct types from objects
                array[index] = Monitor.fromObject(value);
                array[index].root?.forEach(el => {
                    if (el.window) {
                        this.configureWindowSignals(el.window);
                        el.window.change_workspace_by_index(mapKey, false);
                        console.warn(`Window ${el.window.get_title()} (${el.window.get_id()}) workspace : ${el.window.get_workspace().workspace_index} (${mapKey})`);
                    }
                });
            });
            
            TileWindowManager._workspaces.set(mapKey, mapValue);
        });

        this.updateMonitors();
    }


}