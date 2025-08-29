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

    _nr_tiles: number;
    _monitor : number | undefined;

    static id_count = 0;
    static fullscreen : number | undefined;

    private constructor() {
        this.id = Tile.id_count++;

        this._position = new Position();
        this._window = null;

        this._state = TileState.DEFAULT;

        this._leaf = true;
        this._parent = null;
        this._child1 = null;
        this._child2 = null;
        this._orientation = Orientation.None;
        this._nr_tiles = 0;
    }


    public static createTileLeaf(window : Meta.Window, position : Position, monitor : number, parent : Tile | null = null) : Tile {
        let tile = new Tile();
        tile._window = window;
        tile._position = position;
        tile._monitor = monitor;
        tile._parent = parent;
        tile._leaf = true;
        tile._nr_tiles = 1;

        return tile;
    }


    private decrementTiles() {
        this._nr_tiles--;
        if (this._parent)
            this._parent.decrementTiles();
    }

    public get leaf() {
        return this._leaf;
    }

    public addWindowOnBlock(window: Meta.Window) {
        console.warn("addWindowOnBlock");

        if (this.leaf) {
            if (!this._window)
                throw new Error("A leaf must have a window");

            let newPositions = this._position.split();
            let c1 = Tile.createTileLeaf(this._window, newPositions[0], this.monitor, this);
            c1._state = this._state;
            (this._window as any).tile = c1;

            console.warn("c1 " + c1._position.width + " " + c1._position.height + " " + c1._position.proportion + " " + c1.monitor);

            let c2 = Tile.createTileLeaf(window, newPositions[1], this.monitor, this);
            (window as any).tile = c2;

            console.warn("c2 " + c2._position.width + " " + c2._position.height + " " + c2._position.proportion + " " + c2.monitor);

            this._window = null;
            this._leaf = false;
            this._child1 = c1;
            this._child2 = c2;
            this._nr_tiles++;
            this._orientation = this._position.width > this._position.height
                ? Orientation.Horizontal : Orientation.Vertical;
        } else if (this._child1 && this._child2) {
            if (this._child1?._nr_tiles > this._child2?._nr_tiles) {
                this._child2.addWindowOnBlock(window);
            } else {
                this._child1.addWindowOnBlock(window);
            }
            this._nr_tiles++;
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
            //throw new Error("Cannot remove window " + this.id);
            return this;
        }

        if (parent._child1)
            parent._child1._parent = parent;
        if (parent._child2)
            parent._child2._parent = parent;

        if (parent._window)
            (parent._window as any).tile = parent;
        parent.resize(parent._position);
        parent.decrementTiles();

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

    public forEach(fn : (el : Tile) => void) {
        fn(this);
        this._child1?.forEach(fn);
        this._child2?.forEach(fn);
    }

    public update() {
        console.warn(`Update ${this.id}`);

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

                //(this._window as any)?._originalMaximize(Meta.MaximizeFlags.BOTH);

                const workspc = this._window.get_workspace();
                const area = workspc.get_work_area_for_monitor(this._monitor ? this._monitor : 0);

                this._position.x = 0;
                this._position.y = 0;
                this._position.width = area.width;
                this._position.height = area.height;

                console.warn(`area.x : ${area.x}, area.y : ${area.y}, ${this._position.width} x ${this._position.height}`);

                this._window.move_resize_frame(
                    false,
                    area.x + this._position.x,
                    area.y + this._position.y,
                    this._position.width,
                    this._position.height);

            } else {
                this.state = TileState.DEFAULT;

                if (this._window.maximized_horizontally || this._window.maximized_vertically)
                    this._window.unmaximize(Meta.MaximizeFlags.BOTH);

                const workspc = this._window.get_workspace();
                const area = workspc.get_work_area_for_monitor(this._monitor ? this._monitor : 0);

                console.warn(`monitor : ${this._monitor}`);
                console.warn(`area.x : ${area.x}, area.y : ${area.y}, ${this._position.width} x ${this._position.height}`);

                this._window.move_resize_frame(
                    false,
                    area.x + this._position.x,
                    area.y + this._position.y,
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


    public contains(window : Meta.Window) : boolean {
        if (this._window?.get_id() === window.get_id())
            return true;
        return this.child1?.contains(window) || this.child2?.contains(window) 
                ? true : false;
    }

    public addToChild() {
        if (this._child1 && this._child2) {
            this._child1.parent = this;
            this._child2.parent = this;
            this._child1.addToChild();
            this._child2.addToChild();
        }
    }

    public static fromObject(obj : any, parent : Tile | null = null) : Tile {
        let tile = new Tile();
        if (obj._child1 && obj._child2)
            tile.setChild(Tile.fromObject(obj._child1, tile), Tile.fromObject(obj._child2, tile));
        tile.position = Position.fromObject(obj._position);
        tile.state = obj._state;
        tile.leaf = obj._leaf;
        tile.orientation = obj._orientation;
        tile.monitor = obj._monitor;
        tile.nr_tiles = obj._nr_tiles;
        tile.window = obj._window;
        if (parent)
            tile.parent = parent;
        if (tile.window)
            (tile.window as any).tile = tile;

        return tile;
    }

    private set leaf(b : boolean) {
        this._leaf = b;
    }

    private setChild(child1 : Tile, child2 : Tile) {
        this._child1 = child1;
        this._child2 = child2;
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

    public get nr_tiles() {
        return this._nr_tiles;
    }

    private set nr_tiles(n : number) {
        this._nr_tiles = n;
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

    public set monitor(m : number) {
        this._monitor = m;
    }

    public get monitor() {
        return this._monitor ? this._monitor : 0;
    }

}