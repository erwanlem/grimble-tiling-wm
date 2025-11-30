import { Position } from "./position.js"
import Meta from 'gi://Meta';
import { Direction, TileWindowManager } from './tileWindowManager.js';
import GLib from 'gi://GLib';

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
    _updateSource : number | null;

    _workspace : number;

    _nr_tiles: number;
    _monitor : number | undefined;
    _adjacents : boolean[];

    public static padding = 0;
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
        this._workspace = 0;

        this._updateSource = null;

        // west / east / north / south
        this._adjacents = [false, false, false, false];
    }


    /** Tile factory
     * 
     * @param {Meta.Window} window 
     * @param {Position} position 
     * @param {number} monitor 
     * @param {Tile | null} parent 
     * @returns 
     */
    public static createTileLeaf(window : Meta.Window, position : Position, monitor : number, parent : Tile | null = null) : Tile {
        let tile = new Tile();
        tile._window = window;
        tile._position = position;
        tile._monitor = monitor;
        tile._parent = parent;
        tile._leaf = true;
        tile._nr_tiles = 1;
        tile._workspace = 0;

        tile.findAdjacents();

        return tile;
    }


    private decrementTiles() {
        this._nr_tiles--;
        if (this._parent)
            this._parent.decrementTiles();
    }


    public addWindowOnBlock(window: Meta.Window) {

        if (this.leaf) {
            if (!this._window)
                throw new Error("A leaf must have a window");

            let newPositions = this._position.split();
            let c1 = Tile.createTileLeaf(this._window, newPositions[0], this.monitor, this);
            c1._state = this._state;
            (this._window as any).tile = c1;

            let c2 = Tile.createTileLeaf(window, newPositions[1], this.monitor, this);
            (window as any).tile = c2;

            this._window = null;
            this._leaf = false;
            this._child1 = c1;
            this._child2 = c2;
            this._nr_tiles++;
            this._orientation = this._position.width > this._position.height
                ? Orientation.Horizontal : Orientation.Vertical;

            c1.findAdjacents();
            c2.findAdjacents();
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

    
    /** Update tile position and its children size
     * 
     * @param {Position} position 
     */
    public resize(position : Position) {
        this._position = position;
        if (!this._window) {
            let newPositions = this._position.split(this._orientation);
            this._child1?.resize(newPositions[this._child1.position.index]);
            this._child2?.resize(newPositions[this._child2.position.index]);
        }
    }

    public forEach(fn : (el : Tile) => void) {
        fn(this);
        this._child1?.forEach(fn);
        this._child2?.forEach(fn);
    }

    public update() {
        
        if (this._window) {

            if (!this._window.isAlive)
                return;

            if (this._state === TileState.MAXIMIZED) {
                (this._window as any)?._originalMaximize(Meta.MaximizeFlags.BOTH);
                return;
            } else if (this._state === TileState.MINIMIZED) {
                (this._window as any)?._originalMinimize();
                return;
            }

            if (this._window.minimized)
                this._window.unminimize();

            if (this._position.proportion === 1) {
                this.state = TileState.ALONE_MAXIMIZED;

                if (this._window.maximized_horizontally || this._window.maximized_vertically)
                    this._window.unmaximize(Meta.MaximizeFlags.BOTH);

                const workspc = this._window.get_workspace();
                const area = workspc?.get_work_area_for_monitor(this._monitor ? this._monitor : 0);

                if (!area)
                    return;

                this._position.x = 0;
                this._position.y = 0;
                this._position.width = area.width;
                this._position.height = area.height;

                this._window?.move_resize_frame(
                    true,
                    area.x + this._position.x + (this._adjacents[0] ? Tile.padding/2 : Tile.padding),
                    area.y + this._position.y + (this._adjacents[2] ? Tile.padding/2 : Tile.padding),
                    this._position.width - (this._adjacents[1] ? Tile.padding * 1.5 : Tile.padding*2),
                    this._position.height - (this._adjacents[3] ? Tile.padding * 1.5 : Tile.padding*2));

                if (this._updateSource !== null)
                    GLib.Source.remove(this._updateSource);
                this._updateSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    this._window?.move_frame(true,
                        area.x + this._position.x + (this._adjacents[0] ? Tile.padding/2 : Tile.padding),
                        area.y + this._position.y + (this._adjacents[2] ? Tile.padding/2 : Tile.padding));
                    this._updateSource = null;
                    return GLib.SOURCE_REMOVE;
                });

            } else {
                this.state = TileState.DEFAULT;

                if (this._window.maximized_horizontally || this._window.maximized_vertically)
                    this._window.unmaximize(Meta.MaximizeFlags.BOTH);

                const workspc = this._window.get_workspace();
                const area = workspc?.get_work_area_for_monitor(this._monitor ? this._monitor : 0);

                if (!area)
                    return;

                this._window?.move_resize_frame(
                    true,
                    area.x + this._position.x + (this._adjacents[0] ? Tile.padding/2 : Tile.padding),
                    area.y + this._position.y + (this._adjacents[2] ? Tile.padding/2 : Tile.padding),
                    this._position.width - (this._adjacents[1] ? Tile.padding * 1.5 : Tile.padding*2),
                    this._position.height - (this._adjacents[3] ? Tile.padding * 1.5 : Tile.padding*2));

                if (this._updateSource !== null)
                    GLib.Source.remove(this._updateSource);
                this._updateSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    this._window?.move_frame(true,
                        area.x + this._position.x + (this._adjacents[0] ? Tile.padding/2 : Tile.padding),
                        area.y + this._position.y + (this._adjacents[2] ? Tile.padding/2 : Tile.padding));
                    this._updateSource = null;
                    return GLib.SOURCE_REMOVE;
                });
            }

        } else {
            this._child1?.update();
            this._child2?.update();
        }
    }


    /** Leaf to root research
     * 
     * @param {(el : Tile) => boolean} fn 
     * @returns 
     */
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


    /** Classic recursive traversal on tree
     * 
     * @param {(el : Tile) => boolean} fn
     * @returns 
     */
    public find(fn : (el : Tile) => boolean) : Tile | null {
        if (fn(this)) {
            return this;
        } else {
            let r1 = this.child1?.find(fn);
            if (r1)
                return r1;

            let r2 = this.child2?.find(fn);
            if (r2)
                return r2;

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
        tile.adjacents = obj._adjacents;
        tile.workspace = obj._workspace;
        if (parent)
            tile.parent = parent;
        if (tile.window)
            (tile.window as any).tile = tile;

        return tile;
    }


    public findAdjacents() {
        let _monitor = TileWindowManager.getMonitors()[this.monitor];

        let w = _monitor.closestTile(this, Direction.West);
        let e = _monitor.closestTile(this, Direction.East);
        let n = _monitor.closestTile(this, Direction.North);
        let s = _monitor.closestTile(this, Direction.South);

        this._adjacents = [w !== null, e !== null, n !== null, s !== null];
    }

    private setChild(child1 : Tile, child2 : Tile) {
        this._child1 = child1;
        this._child2 = child2;
    }


    public destroy() {
        if (this._updateSource !== null)
            GLib.Source.remove(this._updateSource);
        this._updateSource = null;
        this._window = null;
    }


    /***********************/
    /* GETTERS AND SETTERS */

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

    public get monitor() : number {
        return this._monitor ? this._monitor : 0;
    }

    public get adjacents() : boolean[] {
        return this._adjacents;
    }

    private set adjacents(adj : Array<boolean>) {
        this._adjacents = adj;
    }

    public set workspace(w : number) {
        this._workspace = w;
    }

    public get workspace() : number {
        return this._workspace;
    }

    public get leaf() {
        return this._leaf;
    }

    private set leaf(b : boolean) {
        this._leaf = b;
    }
}