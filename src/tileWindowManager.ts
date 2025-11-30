import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { Orientation, Tile, TileState } from "./tile.js";
import { Position } from "./position.js";
import * as Resize from "./resize.js";
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Monitor } from './monitor.js';
import Shell from 'gi://Shell';
import Mtk from 'gi://Mtk';
import Grimble from './extension.js'

import {TopBarSearchEntry} from './topBarSearchEntry.js';
import {ModalSearchEntry} from './modalSearchEntry.js';

export enum Direction {
    North = 1,
    South,
    West,
    East
}


export class TileWindowManager {

    /**************************************************/
    // Store all signals to be restored when extension is disabled
    _wrappedWindows: Map<Meta.Window, [() => void,
        (dir: Meta.MaximizeFlags | null) => void,
        number, number, number, number, number, number]>;
    _nMonitors : number;

    _windowCreatedSignal: number;
    _windowGrabSignal: number;
    _workspaceAddedSignal : number;
    _workspaceRemovedSignal : number;
    _activeWorkspaceSignal : number
    _grabBeginSignal : number;
    _monitorChangedSignal : number;
    _workareasChangedSignal : number;
    /**************************************************/
    _settings: Gio.Settings | null;

    _userResize : Set<Meta.Window>;

    static locked = false;

    // Alternate windows rotation
    static rotateEven = [0, 0];

    // Search bar widgets
    _topBarSearchEntry : TopBarSearchEntry | undefined;
    _modalSearchEntry : ModalSearchEntry | undefined;

    _sourceId : number | null;

    // Tiles structures
    private static _workspaces : Map<number, Array<Monitor>> = new Map();
    private static _main_monitor : number;


    constructor(extension : Grimble) {
        if (!TileWindowManager._workspaces)
            TileWindowManager._workspaces = new Map();

        TileWindowManager._main_monitor = global.display.get_primary_monitor();

        this._settings = extension._settings;

        this._nMonitors = global.display.get_n_monitors();

        for (let i = 0; i < global.workspace_manager.n_workspaces; i++) {
            let _monitors = new Array(this._nMonitors);
            for (let j = 0; j <_monitors.length; j++) {
                _monitors[j] = new Monitor(j);
            }
            TileWindowManager._workspaces.set(i, _monitors);
        }

        this._wrappedWindows = new Map();
        this._userResize = new Set();

        this._sourceId = null;

        if (TileWindowManager.locked) {
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

        this._workareasChangedSignal = global.display.connect('workareas-changed', () => {
            TileWindowManager._workspaces.forEach(val => {
                val.forEach(m => m.updateSize());
            });
            this.updateMonitors();
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

        this._workspaceRemovedSignal = global.workspace_manager.connect('workspace-removed', (_, index) => {
            this._onWorkspaceRemoved(index);
        });

        this._activeWorkspaceSignal = global.workspace_manager.connect('active-workspace-changed', () => {
            this.updateMonitors();
            this.updateAdjacents();
        });

        this._monitorChangedSignal = global.backend.get_monitor_manager().connect('monitors-changed', () => {
            const n = global.display.get_n_monitors();
            if (n !== this._nMonitors) {
                let diff = n - this._nMonitors;
                this._nMonitors = n;
                if (diff > 0) {
                    this._addMonitors(diff);
                } else {
                    this._removeMonitors(-diff);
                }
            }
        });
    }



    public static getMonitors(workspaceIndex : number | undefined = undefined) : Monitor[] {
        let wk;
        if (!workspaceIndex)
            wk = TileWindowManager._workspaces.get(global.workspace_manager.get_active_workspace_index());
        else
            wk = TileWindowManager._workspaces.get(workspaceIndex);
        if (wk)
            return wk;
        else
            return [];
    }

    private _addMonitors(n : number) {
        let newPrimMonitor = global.display.get_primary_monitor();
        TileWindowManager._workspaces.forEach((val, _, __) => {
            let currPrim : Monitor | null = null;
            if (newPrimMonitor !== TileWindowManager._main_monitor)
                currPrim = val.filter(e => e.index === TileWindowManager._main_monitor)[0];
            for (let i = 0; i < n; i++) {
                const index = val.length;
                val.push(new Monitor(index));
                // Move content on the new primary screen
                if (index === newPrimMonitor) {
                    val[index].fullscreen = currPrim?.fullscreen ?? false;
                    val[index].root = currPrim?.root ?? null;
                    val[index].root?.forEach(el => {el.monitor = index});

                    if (currPrim?.fullscreen) currPrim.fullscreen = false;
                    if (currPrim?.root) currPrim.root = null;
                }
            }
        });
        TileWindowManager._main_monitor = newPrimMonitor;
    }

    private _removeMonitors(n : number) {
        TileWindowManager._workspaces.forEach((val, _, __) => {
            let windows = [];
            for (let i = 0; i < n; i++) {
                windows.push(val.pop());
            }

            for (let i = 0; i < windows.length; i++) {
                windows[i]?.root?.forEach(t => {
                    if (t.window) this._insertWindow(t.window);
                });
            }
        });
        TileWindowManager._main_monitor = global.display.get_primary_monitor();

        this.updateMonitors();
        this.updateAdjacents();
    }


    /**
     * Refresh **ALL** existing tiles.
     */
    public updateMonitors() {
        TileWindowManager._workspaces.forEach((value, _) => {
            value.forEach(el => el.root?.update());
        });
    }

    public updateAdjacents() {
        TileWindowManager._workspaces.forEach((value, _) => {
            value.forEach(el => el.root?.forEach(t => t.findAdjacents()));
        });
    }


    public destroy() {
        global.display.disconnect(this._windowCreatedSignal);
        global.display.disconnect(this._windowGrabSignal);
        global.display.disconnect(this._grabBeginSignal);
        global.display.disconnect(this._workareasChangedSignal);
        global.workspace_manager.disconnect(this._workspaceAddedSignal);
        global.workspace_manager.disconnect(this._workspaceRemovedSignal);
        global.workspace_manager.disconnect(this._activeWorkspaceSignal);
        global.backend.disconnect(this._monitorChangedSignal);

        if (Resize.resizeSourceId !== null)
            GLib.Source.remove(Resize.resizeSourceId);

        // Disconnect each window
        this._wrappedWindows.forEach(
            (value, key) => {
                key.minimize = value[0]; key.maximize = value[1];
                key.disconnect(value[2]); key.disconnect(value[3]);
                key.disconnect(value[4]); key.disconnect(value[5]);
                key.disconnect(value[6]); key.disconnect(value[7]);
                this._wrappedWindows.delete(key);
            }
        );

        this._wrappedWindows.clear();
        
        this._topBarSearchEntry?.destroy();

        (TileWindowManager._main_monitor as any) = null;
        (TileWindowManager._workspaces as any) = null;
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
     * @param {Meta.Window} window 
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


        for (var [_, value] of TileWindowManager._workspaces) {
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
        for (let i = 0; i < _monitors.length; i++) {
            _monitors[i] = new Monitor(i);
        }

        if (!TileWindowManager._workspaces.has(index))
            TileWindowManager._workspaces.set(index, _monitors);
    }


    private _onWorkspaceRemoved(index : number) {
        TileWindowManager._workspaces.delete(index);
        let newMap = new Map();
        TileWindowManager._workspaces.forEach((value, key) => {
            if (key > index) {
                value.forEach(el => el.root?.forEach(t => {t.workspace = key-1;}));
                newMap.set(key-1, value);
            } else {
                newMap.set(key, value);
            }
        });

        TileWindowManager._workspaces = newMap;

        this.updateMonitors();
        this.updateAdjacents();
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
            let w = window.get_workspace()?.index();
            if (w !== null) {
                window.change_workspace_by_index(w, false);
                this._removeWindow(window);
                this._insertWindow(window, w);
                tile.workspace = w;

                this.updateMonitors();
                this.updateAdjacents();
            }
        }
    }




    /** Connect to signals and remove some functions
     * 
     * @param {Meta.Window} window 
     */
    private configureWindowSignals(window: Meta.Window) {

        let minimizeSignal = window.connect('notify::minimized', () => {
            if (!window.minimized) {
                let tile : Tile = (window as any).tile;
                if (tile.state === TileState.MINIMIZED) {
                    if (TileWindowManager.getMonitors()[tile.monitor].fullscreen) {
                        if (this._settings?.get_int('fullscreen-switch') === 0)
                            this.maximizeTile(window, true);
                        else
                            this.maximizeTile(window);
                    }
                }
            } else {
                if ((window as any).tile.state === TileState.MINIMIZED)
                    return;

                window.unminimize();
            }
        });

        let maximizeSignal1 = window.connect(
            'notify::maximized-horizontally',
            () => {
                if ((window as any).tile.state === TileState.MAXIMIZED) {
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
                if ((window as any).tile.state === TileState.MAXIMIZED) {
                    return;
                }

                if (window.maximized_horizontally || window.maximized_vertically) {
                    window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
            }
        );

        let unmanagedSignal = window.connect('unmanaged', () =>  {
            this._removeWindow(window);
            this._removeWindowSignals(window);
        });

        let workspaceChangedSignal = window.connect('workspace-changed', 
            (w) => this._windowWorkspaceChanged(w)
        );

        let sizeChangedSignal = window.connect('size-changed', (w) => {
            let tile : Tile = (w as any).tile;
            if (!this._userResize.has(w) 
                && (tile.position.width !== w.get_frame_rect().width 
                || tile.position.height !== w.get_frame_rect().height))
                tile.update();
        });

        (window as any)._originalMaximize = window.maximize;
        (window as any)._originalMinimize = window.minimize;

        this._wrappedWindows.set(
            window,
            [window.minimize, window.maximize, minimizeSignal,
                maximizeSignal1, maximizeSignal2, 
                unmanagedSignal, workspaceChangedSignal, sizeChangedSignal]
        );

        window.minimize = () => { };
        window.maximize = () => { };
    }


    private _addNewWindow(window: Meta.Window) {
        if (!this._isValidWindow(window))
            return;

        this.configureWindowSignals(window);

        this._insertWindow(window);
    }

    private _insertWindow(window: Meta.Window, workspace : number | null = null) {
        let _monitors = TileWindowManager._workspaces.get(workspace != null ? workspace : window.get_workspace()?.index());
        if (!_monitors)
            return;

        let selectedMonitor: Monitor;


        // Select monitor
        if (this._settings?.get_int('monitor-tile-insertion-behavior') === 0) {
            selectedMonitor = Monitor.bestFitMonitor(_monitors);
        } else {
            let m = global.display.get_current_monitor();
            selectedMonitor = _monitors[m];
        }

        // Selected monitor index
        let index = selectedMonitor.index;

        // Now insert tile on selected monitor
        if (selectedMonitor.size() === 0) {
            let tile = Tile.createTileLeaf(window, new Position(1.0, 0, 0, 0, 0), index);
            tile.workspace = window.get_workspace().index();

            (window as any).tile = tile;

            _monitors[index].root = tile;
            _monitors[index].root?.update();
        } else {
            _monitors[index].root?.addWindowOnBlock(window);
            (window as any).tile.workspace = window.get_workspace().index();

            if (_monitors[index].fullscreen) {
                (window as any).tile.state = TileState.MINIMIZED;
            }

            _monitors[index].root?.update();
        }
    }


    private _removeWindowSignals(window : Meta.Window) {
        (window as any).tile?.destroy();

        // Disconnect signals
        let s = this._wrappedWindows.get(window);
        if (s) {
            window.minimize = s[0];  window.maximize = s[1];
            window.disconnect(s[2]); window.disconnect(s[3]);
            window.disconnect(s[4]); window.disconnect(s[5]);
            window.disconnect(s[6]); window.disconnect(s[7]);
        }
        
        this._wrappedWindows.delete(window);
    }


    private _removeWindow(window: Meta.Window) {

        // get Tile from window
        let tile: Tile = (window as any).tile;

        // Not found
        if (!tile)
            return;

        let m = tile.monitor;
        if (TileWindowManager.getMonitors()[m].fullscreen) {
            TileWindowManager.getMonitors()[m].fullscreen = false;

            let focus: null | Tile = null;
            TileWindowManager.getMonitors()[m].root?.forEach(el => {
                el.state = TileState.DEFAULT;
                el.window?.unminimize();
                if (!focus && el.window !== window) {
                    el.window?.focus(0);
                    focus = el;
                }
            });
        }

        if (tile.removeTile() === null) {
            TileWindowManager.getMonitors(tile.workspace)[m].root = null;
        } else {
            TileWindowManager.getMonitors()[m].root?.update();
        }

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
                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    TileWindowManager.getMonitors()[m].root?.update();
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_E:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeE(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_W:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeW(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_N:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_S:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;
            
            case Meta.GrabOp.RESIZING_NE:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    Resize.resizeE(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_NW:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeN(tile, rect);
                    Resize.resizeW(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_SE:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    Resize.resizeE(tile, rect);
                    this._sourceId = null;
                    return GLib.SOURCE_REMOVE;
                });
                break;

            case Meta.GrabOp.RESIZING_SW:
                rect = window.get_frame_rect();

                if (this._sourceId !== null)
                    GLib.Source.remove(this._sourceId);
                this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    Resize.resizeS(tile, rect);
                    Resize.resizeW(tile, rect);
                    this._sourceId = null;
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
     * @param {Meta.GrabOp} op
     * @param {number} resizeGap
     * @returns void
     */
    public resizeFocusedWindow(op : Meta.GrabOp, resizeGap : number = 10) {
        let window = global.display.focusWindow;
        if (!window)
            return;

        let tile = (window as any).tile;

        if (op === Meta.GrabOp.RESIZING_E) {
            if (tile.adjacents[1]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width + resizeGap,
                    height: tile.position.height
                });
                Resize.resizeE(tile, r);
            } else if (tile.adjacents[0]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x + resizeGap, 
                    y: tile.position.y,
                    width: tile.position.width - resizeGap,
                    height: tile.position.height
                });
                Resize.resizeW(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_W) {            
            if (tile.adjacents[0]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x - resizeGap, 
                    y: tile.position.y,
                    width: tile.position.width + resizeGap,
                    height: tile.position.height
                });
                Resize.resizeW(tile, r);
            } else if (tile.adjacents[1]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width - resizeGap,
                    height: tile.position.height
                });
                Resize.resizeE(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_N) {
            if (tile.adjacents[2]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y - resizeGap,
                    width: tile.position.width,
                    height: tile.position.height + resizeGap
                });
                Resize.resizeN(tile, r);
            } else if (tile.adjacents[3]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width,
                    height: tile.position.height - resizeGap
                });
                Resize.resizeS(tile, r);
            }
        } else if (op === Meta.GrabOp.RESIZING_S) {
            if (tile.adjacents[3]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y,
                    width: tile.position.width,
                    height: tile.position.height + resizeGap
                });
                Resize.resizeS(tile, r);
            } else if (tile.adjacents[2]) {
                let r = new Mtk.Rectangle({
                    x: tile.position.x, 
                    y: tile.position.y + resizeGap,
                    width: tile.position.width,
                    height: tile.position.height - resizeGap
                });
                Resize.resizeN(tile, r);
            }
        }
    }


    /** Clock wise windows rotation. 
     * Rotates the parent tile (if existing).
     * 
     * @param {Meta.Window} window 
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
                newPositions[TileWindowManager.rotateEven[0] === 0 ? 0 : 1].splitProportion = parent.child1.position.splitProportion;
                newPositions[TileWindowManager.rotateEven[0] === 0 ? 1 : 0].splitProportion = parent.child2.position.splitProportion;
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[0] === 0 ? 0 : 1]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[0] === 0 ? 1 : 0]);
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
                newPositions[TileWindowManager.rotateEven[1] === 0 ? 1 : 0].splitProportion = parent.child1.position.splitProportion;
                newPositions[TileWindowManager.rotateEven[1] === 0 ? 0 : 1].splitProportion = parent.child2.position.splitProportion;
                parent.child1.resize(newPositions[TileWindowManager.rotateEven[1] === 0 ? 1 : 0]);
                parent.child2.resize(newPositions[TileWindowManager.rotateEven[1] === 0 ? 0 : 1]);
                parent.forEach(el => el.findAdjacents());
                TileWindowManager.rotateEven[1] = (TileWindowManager.rotateEven[1] + 1) % 2;
                parent.update();
            } else {
                return;
            }
            parent.orientation = Orientation.Horizontal;
        }
    }


    /** Maximize the currently focused window.
     * Others windows are reduced using tile specific state.
     * 
     * @param {Meta.Window} window 
     * @param {boolean} replace true to stay in fullscreen and just replace the window otherwise false
     * @returns 
     */
    public maximizeTile(window: Meta.Window, replace = false) {
        let tile: Tile | undefined = (window as any).tile;
        if (!tile)
            return;

        let m = tile.monitor;

        if (TileWindowManager.getMonitors()[tile.monitor].fullscreen) {
            TileWindowManager.getMonitors()[tile.monitor].fullscreen = false;

            TileWindowManager.getMonitors()[m].root?.forEach(el => {
                el.state = TileState.DEFAULT;
                if (el.window?.minimized) {
                    el.window?.unminimize();
                }
            });

            if (replace) {
                TileWindowManager.getMonitors()[m].fullscreen = true;
                TileWindowManager.getMonitors()[m].root?.forEach(el => {
                    if (el.id === tile.id) {
                        el.state = TileState.MAXIMIZED;
                    } else {
                        el.state = TileState.MINIMIZED;
                    }
                });
            }
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
        let window : Meta.Window | null = global.display.get_focus_window();
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


        public changeFocus(dir: Direction) {
        let window: Meta.Window | null = global.display.get_focus_window();
        if (!window)
            return;

        let tile: Tile = (window as any).tile;
        if (!tile.window)
            return;


        if (TileWindowManager.getMonitors()[tile.monitor].fullscreen === true) {

            let mon = TileWindowManager.getMonitors()[tile.monitor].closestMonitor(dir);
            if (mon === null)
                return;
            let newFocus = TileWindowManager.getMonitors()[mon].getTile(Direction.South);
            if (newFocus)
                newFocus?.window?.focus(0);

        } else {
            
            let newFocus = TileWindowManager.getMonitors()[tile.monitor].closestTile(tile, dir);
            if (newFocus === null) {
                let mon = TileWindowManager.getMonitors()[tile.monitor].closestMonitor(dir);

                if (mon === null)
                    return;
                switch (dir) {
                    case Direction.North:
                        newFocus = TileWindowManager.getMonitors()[mon].getTile(Direction.South);
                        if (newFocus)
                            newFocus?.window?.focus(0);
                        break;
                    case Direction.South:
                        newFocus = TileWindowManager.getMonitors()[mon].getTile(Direction.North);
                        if (newFocus)
                            newFocus?.window?.focus(0);
                        break;
                    case Direction.East:
                        newFocus = TileWindowManager.getMonitors()[mon].getTile(Direction.West);
                        if (newFocus)
                            newFocus?.window?.focus(0);
                        break;
                    case Direction.West:
                        newFocus = TileWindowManager.getMonitors()[mon].getTile(Direction.East);
                        if (newFocus)
                            newFocus?.window?.focus(0);
                        break;

                    default:
                        return;
                }
            } else {
                newFocus?.window?.focus(0);
            }
        }
    }



    public createSearchBar() {
        if (this._topBarSearchEntry && this._topBarSearchEntry.isAlive()) {
            this._topBarSearchEntry.destroy();
            this._topBarSearchEntry = undefined;
            return ;
        }

        if (this._settings)
            this._topBarSearchEntry = new TopBarSearchEntry(this._settings);
    }


    public refresh() {
        TileWindowManager.getMonitors().forEach(el => el.root ? el.root.update() : null);
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

        this.updateMonitors();
        this.updateAdjacents();
    }


    public moveToNextMonitor() {
        let window = global.display.get_focus_window();
        this._removeWindow(window);
        
        let tile : Tile = (window as any).tile;
        let monitors = TileWindowManager.getMonitors();
        let newMonitorIndex = (tile.monitor + 1) % monitors.length;
        let newMonitor = monitors[newMonitorIndex];
        if (newMonitor.size() === 0) {
            let newTile = Tile.createTileLeaf(window, new Position(1.0, 0, 0, 0, 0), newMonitorIndex);
            newTile.workspace = window.get_workspace().index();
            (window as any).tile = newTile;

            newMonitor.root = newTile;            
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

        TileWindowManager.locked = true;

        const userPath = GLib.get_user_config_dir();
        const parentPath = GLib.build_filenamev([userPath, '/grimble']);
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
        if (!TileWindowManager.locked)
            return;

        TileWindowManager.locked = false;

        const userPath = GLib.get_user_config_dir();
        const path = GLib.build_filenamev([userPath, '/grimble/tilingWmSession2.json']);
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
        map.forEach((mapValue, mapKey, _) => {
            mapValue.forEach((value, index, array) => {
                // We need to rebuild correct types from objects
                array[index] = Monitor.fromObject(value);
                array[index].root?.forEach(el => {
                    if (el.window) {
                        this.configureWindowSignals(el.window);
                        el.window.change_workspace_by_index(mapKey, false);
                    }
                });
            });
            
            TileWindowManager._workspaces.set(mapKey, mapValue);
        });

        this.updateMonitors();
    }
}