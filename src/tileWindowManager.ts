import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { Orientation, Tile, TileState } from "./tile.js";
import { Position } from "./position.js";
import * as Resize from "./resize.js";
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export class TileWindowManager {
    _wrappedWindows: Map<Meta.Window, [() => void,
        (dir: Meta.MaximizeFlags | null) => void,
        number, number, number]>;
    _windowCreatedSignal: number;
    _windowLeftSignal: number;
    _windowGrabSignal: number;

    _extensionObject: Extension | null = null;
    _settings: Gio.Settings | undefined;

    _fullscreenState: boolean = false;

    static rotateEven = [0, 0];

    _focusHistory: Array<Meta.Window>;
    root: Tile | null;

    constructor() {
        this._extensionObject = Extension.lookupByUUID('gtile@lmt.github.io');
        this._settings = this._extensionObject?.getSettings();
        this.root = null;
        this._focusHistory = [];

        this._wrappedWindows = new Map();

        this._windowCreatedSignal = global.display.connect(
            'window-created',
            (display, obj) => this._onWindowCreated(display, obj)
        );

        this._windowLeftSignal = global.display.connect(
            'window-left-monitor',
            (display, obj, window) => this._removeWindow(window)
        );

        this._windowGrabSignal = global.display.connect(
            'grab-op-end',
            (_, window, op) => this._onGrabBegin(window, op)
        );

        global.get_window_actors().forEach(
            actor => {
                if (actor.meta_window
                    && actor.meta_window.get_window_type() === Meta.WindowType.NORMAL) {
                    this._onWindowCreated(null, actor.meta_window);
                    this.root?.update();
                }
            }
        );
    }

    public getFocusedWindow() {
        if (this._focusHistory.length > 0)
            return this._focusHistory[0];
        else
            return null;
    }

    public destroy() {
        global.display.disconnect(this._windowCreatedSignal);
        global.display.disconnect(this._windowLeftSignal);
        global.display.disconnect(this._windowGrabSignal);

        this._wrappedWindows.forEach(
            (value, key) => {
                key.minimize = value[0]; key.maximize = value[1];
                key.disconnect(value[2]); key.disconnect(value[3]);
                key.disconnect(value[4]);
                this._wrappedWindows.delete(key);
            }
        );
        this._wrappedWindows.clear();
    }

    private updateFocusHistory(window: Meta.Window, focused = true) {
        this._focusHistory = this._focusHistory.filter((w) => w !== window)
        if (focused) this._focusHistory.unshift(window)
    }

    private _onWindowCreated(_: Meta.Display | null, window: Meta.Window) {
        console.warn("Window created");

        if (window.get_window_type() !== Meta.WindowType.NORMAL)
            return;

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
            [window.minimize, window.maximize, 0, 0, 0]
        );

        window.minimize = () => { };
        window.maximize = () => { };

        return this._addNewWindow(window);
    }

    private _addNewWindow(window: Meta.Window) {
        console.warn("New window");
        if (!this.root) {
            let tile = new Tile();
            let position = new Position(1.0, 0, 0, 0, 0);
            tile.window = window;
            tile.position = position;
            (window as any).tile = tile;

            this.root = tile;

            window.get_compositor_private().connect(
                'first-frame',
                () => tile.update()
            );
        } else {
            if (this._settings?.get_int('tile-insertion-behavior') == 0) {
                this.root.addWindowOnBlock(window);
            } else {
                let focusWindow = this.getFocusedWindow();
                if (focusWindow) {
                    let tile: Tile = (focusWindow as any).tile;
                    tile.addWindowOnBlock(window);
                } else {
                    this.root.addWindowOnBlock(window);
                }
            }

            if (this._fullscreenState) {
                (window as any).tile.state = TileState.MINIMIZED;
            }

            window.get_compositor_private().connect(
                'first-frame',
                () => this.root?.update()
            );
        }
    }

    private _removeWindow(window: Meta.Window) {
        this.updateFocusHistory(window, false);

        // get Tile from window
        let tile = (window as any).tile;

        // Not found
        if (!tile)
            return;

        if (tile.removeTile() === null)
            this.root = null;
        else
            this.root?.update();
    }

    private _onGrabBegin(window: Meta.Window, op: Meta.GrabOp) {
        if (!window) return;

        let tile = (window as any).tile;

        if (!tile)
            return;

        if (op === Meta.GrabOp.MOVING) {
            let rect = window.get_frame_rect();
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                (window as any).tile.update();
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


    public maximizeTile(window: Meta.Window) {
        let tile: Tile | undefined = (window as any).tile;
        if (!tile)
            return;

        if (this._fullscreenState) {
            this._fullscreenState = false;

            this.root?.forEach(el => {
                el.state = TileState.DEFAULT;
                if (el.id === tile.id) {
                } else {
                    el.window?.unminimize();
                }
            });
        } else {
            this._fullscreenState = true;

            this.root?.forEach(el => {
                if (el.id === tile.id) {
                    el.state = TileState.MAXIMIZED;
                } else {
                    el.state = TileState.MINIMIZED;
                }
            });
        }

        this.root?.update();
    }


}