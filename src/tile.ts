import { Position } from "./position.js"
import Meta from 'gi://Meta';


export enum Orientation {
    Vertical = 1,
    Horizontal,
    None
}

export enum TileState {
    DEFAULT,
    MINIMIZED,
    MAXIMIZED,
    ALONE_MAXIMIZED
}

export class Tile {
    readonly id: number;

    _leaf: boolean;
    _parent: Tile | null;
    _child1: Tile | null;
    _child2: Tile | null;

    _position: Position;
    _window: Meta.Window | null;
    _state : TileState;
    _orientation: Orientation;

    _children: number;

    static id_count = 0;
    static fullscreen : number | undefined;

    constructor();
    constructor() {
        this.id = Tile.id_count++;

        this._position = new Position();
        this._window = null;

        this._state = TileState.DEFAULT;

        this._leaf = true;
        this._parent = null;
        this._child1 = null;
        this._child2 = null;
        this._orientation = Orientation.None;
        this._children = 0;
    }

    private decrementChildren() {
        this._children--;
        if (this._parent)
            this._parent.decrementChildren();
    }

    public get leaf() {
        return this._leaf;
    }

    public addWindowOnBlock(window: Meta.Window) {

        if (this.leaf) {
            if (!this._window)
                throw new Error("A leaf must have a window");

            let newPositions = this._position.split();
            let c1 = new Tile();
            c1.window = this._window;
            c1.position = newPositions[0];
            c1._parent = this;
            c1._state = this.state;
            (this._window as any).tile = c1;

            // console.warn("c1 " + c1._position.width + " " + c1._position.height);

            let c2 = new Tile();
            c2.window = window;
            c2.position = newPositions[1];
            c2._parent = this;
            (window as any).tile = c2;

            // console.warn("c2 " + c2._position.width + " " + c2._position.height);

            this._window = null;
            this._leaf = false;
            this._child1 = c1;
            this._child2 = c2;
            this._orientation = this._position.width > this._position.height
                ? Orientation.Horizontal : Orientation.Vertical;
        } else if (this._child1 && this._child2) {
            if (this._child1?.children > this._child2?._children) {
                this._child2.addWindowOnBlock(window);
                this._child2._children++;
            } else {
                this._child1.addWindowOnBlock(window);
                this._child1._children++;
            }
        } else {
            throw new Error("Unexpected state to add window");
        }
    }

    public removeTile() {
        if (this._window == null || this._child1 || this._child2 || !this._leaf)
            throw new Error("Invalid remove state");

        let parent = this._parent;
        if (!parent)
            return null;

        if (parent._child1 === this && parent._child2) {
            parent._leaf = parent._child2._leaf;
            parent._orientation = parent._child2._orientation;
            parent._window = parent._child2._window;
            parent._child1 = parent._child2._child1;
            parent._child2 = parent._child2._child2;
        } else if (parent._child2 === this && parent._child1) {
            parent._leaf = parent._child1._leaf;
            parent._orientation = parent._child1._orientation;
            parent._window = parent._child1._window;
            parent._child2 = parent._child1._child2;
            parent._child1 = parent._child1._child1;
        } else {
            throw new Error("Cannot remove window");
        }

        if (parent._child1)
            parent._child1._parent = parent;
        if (parent._child2)
            parent._child2._parent = parent;

        if (parent._window)
            (parent._window as any).tile = parent;
        parent.resize(parent._position);
        console.warn("Resize " + parent._position.width + " " + parent._position.height);
        parent.decrementChildren();

        return parent;
    }

    public resize(position : Position) {
        this._position = position;
        if (!this._window) {
            let newPositions = this._position.split(this._orientation);
            this._child1?.resize(newPositions[0]);
            this._child2?.resize(newPositions[1]);
        }
    }

    public set orientation(o : Orientation) {
        this._orientation = o;
    }

    public get orientation() {
        return this._orientation;
    }

    public set parent(p: Tile) {
        this._parent = p;
    }

    public get parent() : Tile | null {
        return this._parent;
    }

    public get children() {
        return this._children;
    }

    public get child1() {
        return this._child1;
    }

    public get child2() {
        return this._child2;
    }

    public set position(pos: Position) {
        this._position = pos;
    }

    public get position() {
        return this._position;
    }

    public set window(w: Meta.Window) {
        this._window = w;
        this._children++;
    }

    public get window() : Meta.Window | null {
        return this._window;
    }

    public set state(value : TileState) {
        this._state = value;
    }

    public get state() {
        return this._state;
    }

    public forEach(fn : (el : Tile) => void) {
        fn(this);
        this._child1?.forEach(fn);
        this._child2?.forEach(fn);
    }

    public update() {

        if (this._window) {

            if (this._state === TileState.MAXIMIZED) {
                (this._window as any)?._originalMaximize(Meta.MaximizeFlags.BOTH);
                return;
            } else if (this._state === TileState.MINIMIZED) {
                (this._window as any)?._originalMinimize();
                return;
            }

            if (this._position.proportion == 1) {
                this.state = TileState.ALONE_MAXIMIZED;

                (this._window as any)?._originalMaximize(Meta.MaximizeFlags.BOTH);

                let rect = this._window.get_frame_rect();

                const workspc = this._window.get_workspace();
                const area = workspc.get_work_area_for_monitor(this._window.get_monitor());

                this._position.x = area.x;
                this._position.y = area.y;
                this._position.width = area.width;
                this._position.height = area.height;

            } else {
                this.state = TileState.DEFAULT;

                if (this._window.maximized_horizontally || this._window.maximized_vertically)
                    this._window.unmaximize(Meta.MaximizeFlags.BOTH);

                console.warn("Update " + this.id);
                this._window?.move_resize_frame(
                    false,
                    this._position.x,
                    this._position.y,
                    this._position.width,
                    this._position.height);
            }

        } else {
            this._child1?.update();
            this._child2?.update();
        }
    }

    public findParent(fn : (el : Tile) => boolean) : Tile | null {
        if (fn(this)) {
            if (!this._parent)
                return this;
            let res = this._parent.findParent(fn);
            if (res)
                return res;
            else
                return this;
        } else {
            return null;
        }
    }


    public getSibling() {
        if (this === this?._parent?._child1)
            return this?._parent?._child2;
        else if (this === this?._parent?._child2)
            return this?._parent?._child1;
        else
            return null;
    }

}