import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import { Tile } from "./tile.js";
import { Position } from "./position.js";
import * as Resize from "./resize.js"

export class TileWindowManager {
    _wrappedWindows: Map<Meta.Window, [() => void,
        (dir: Meta.MaximizeFlags | null) => void,
        number, number, number]>;
    _windowCreatedSignal: number;
    _windowLeftSignal: number;
    _windowGrabSignal: number;

    root: Tile | null;


    constructor() {
        this.root = null;


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

    public disable() {
        global.display.disconnect(this._windowCreatedSignal);
        global.display.disconnect(this._windowLeftSignal);
        global.display.disconnect(this._windowGrabSignal);
    }

    private _onWindowCreated(_: Meta.Display | null, window: Meta.Window) {
        console.warn("Window created");

        if (window.get_window_type() !== Meta.WindowType.NORMAL)
            return;

        let minimizeSignal = window.connect('notify::minimized', () => {
            if (window.minimized) {
                window.unminimize();
            }
        });
        let maximizeSignal1 = window.connect(
            'notify::maximized-horizontally',
            () => {
                if ((window as any).tile.maximized) {
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
                if ((window as any).tile.maximized) {
                    return;
                }

                if (window.maximized_horizontally || window.maximized_vertically) {
                    window.unmaximize(Meta.MaximizeFlags.BOTH);
                }
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

    public _resetWindows() {
        global.display.disconnect(this._windowCreatedSignal);

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
            this.root.addWindowOnBlock(window);

            console.warn("root " + this.root?._position.width + " " + this.root?._position.height);
            console.warn("child 1 " + this.root._child1?._position.width + " " + this.root._child1?._position.height);
            console.warn("child 2 " + this.root._child2?._position.width + " " + this.root._child2?._position.height);

            window.get_compositor_private().connect(
                'first-frame',
                () => this.root?.update()
            );
        }
    }

    private _removeWindow(window: Meta.Window) {
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
                console.warn("Move frame " + rect.x + " " + rect.y);
                console.warn(tile._position.x + " " + tile._position.y);
                window.move_resize_frame(true, tile._position.x, tile._position.y, tile._position.width, tile._position.height);
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

}