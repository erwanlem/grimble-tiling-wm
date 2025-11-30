import { Tile, TileState } from './tile.js';
import { Direction } from './tileWindowManager.js';
import { Position } from './position.js';


export class Monitor {
    _root : Tile | null;
    _index : number;
    _fullscreenState: boolean = false;

    constructor(index : number) {
        this._index = index;
        this._root = null;
    }

    public set root(root : Tile | null) {
        this._root = root;
    }

    public get root() {
        return this._root;
    }

    public get index() {
        return this._index;
    }

    public get fullscreen() {
        return this._fullscreenState;
    }

    public set fullscreen(b : boolean) {
        this._fullscreenState = b;
    }

    public size() : number {
        return this._root ? this._root._nr_tiles : 0;
    }

    public updateSize() {
        if (this._root) {
            const area = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(this.index);
            if (area) {
                let pos = new Position(1.0, 0, 0, area.width, area.height);
                pos.splitProportion = this._root.position.splitProportion;
                this._root.resize(pos);
            }
        }
    }

    public static bestFitMonitor(monitors : Array<Monitor>) : Monitor {
        return monitors.reduce(
            (acc, val : Monitor) => val.size() < acc.size() ? val : acc, 
            monitors[0]
        );
    }

    private static tileDistance(t1 : Tile, t2 : Tile) : number {
        let vector = [t1.position.x - t2.position.x, t1.position.y - t2.position.y];

        return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
    }

    public closestTile(source : Tile, dir : Direction) : Tile | null {
        // Class to store the result
        class BestTile {
            public tile : Tile | null = null;
            public distance : number | null = null;

            public constructor(tile : Tile | null = null, distance : number | null = null) {
                this.tile = tile;
                this.distance = distance;
            }
        };
        
        // We search for the closest tile in a Direction. We recursively iterate the tree
        let findClosest = (tile : Tile) : BestTile => {
            switch (dir) {
                case Direction.East:
                    if (tile.leaf && tile.position.x > source.position.x) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1);
                        let res2 = findClosest(tile.child2);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.West:
                    if (tile.leaf && tile.position.x < source.position.x) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1);
                        let res2 = findClosest(tile.child2);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.North:
                    if (tile.leaf && tile.position.y < source.position.y) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1);
                        let res2 = findClosest(tile.child2);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                case Direction.South:
                    if (tile.leaf && tile.position.y > source.position.y) {
                        return new BestTile(tile, Monitor.tileDistance(tile, source));
                    } else if (tile.leaf) {
                        return new BestTile();
                    } else if (tile.child1 && tile.child2) {
                        let res1 = findClosest(tile.child1);
                        let res2 = findClosest(tile.child2);
                        if ((res1.distance && res2.distance && res1.distance > res2.distance) 
                            || (res2.distance && !res1.distance)) {
                            return res2;
                        } else if ((res1.distance && res2.distance && res1.distance < res2.distance) 
                            || (res1.distance && !res2.distance)) {
                            return res1;
                        } else {
                            return new BestTile();
                        }
                    }
                    return new BestTile();
                default:
                    return new BestTile();
            }
        }

        if (this.root) {
            let res = findClosest(this.root);
            return res.tile;
        }

        return null;
    }

    public destroy() {
        this._index = -1;
        this._root = null;
    }

    public static fromObject(obj : Monitor) {
        let monitor = new Monitor(obj._index);
        monitor.fullscreen = obj._fullscreenState;

        if (!obj._root)
            monitor.root = null;
        else
            monitor.root = Tile.fromObject(obj._root);

        return monitor;
    }



    public closestMonitor(dir: Direction): number | null {
        let nMonitors = global.display.get_n_monitors();
        let _currGeo = global.display.get_monitor_geometry(this.index);
        let min = undefined;
        let best: number | null = null;
        
        switch (dir) {
            case Direction.North:

                for (let i = 0; i < nMonitors; i++) {
                    if (this.index !== i) {
                        let _geometry = global.display.get_monitor_geometry(i);
                        if (_geometry.y < _currGeo.y && (min === undefined || _geometry.y > min)) {
                            min = _geometry.y;
                            best = i;
                        }
                    }
                }
                return best;
            case Direction.South:
                for (let i = 0; i < nMonitors; i++) {
                    if (this.index !== i) {
                        let _geometry = global.display.get_monitor_geometry(i);
                        if (_geometry.y > _currGeo.y && (min === undefined || _geometry.y < min)) {
                            min = _geometry.y;
                            best = i;
                        }
                    }
                }
                return best;

            case Direction.East:
                for (let i = 0; i < nMonitors; i++) {
                    if (this.index !== i) {
                        let _geometry = global.display.get_monitor_geometry(i);
                        if (_geometry.x > _currGeo.x && (min === undefined || _geometry.x < min)) {
                            min = _geometry.x;
                            best = i;
                        }
                    }
                }
                return best;

            case Direction.West:
                for (let i = 0; i < nMonitors; i++) {
                    if (this.index !== i) {
                        let _geometry = global.display.get_monitor_geometry(i);
                        if (_geometry.x < _currGeo.x && (!min || _geometry.x > min)) {
                            min = _geometry.x;
                            best = i;
                        }
                    }
                }
                return best;

            default:
                return null;
        }
    }



    /** Returns tile closest to the edge on a monitor
     * - If the monitor is in fullscreen it returns the maximized window
     * 
     * @param {Direction} dir
     * @returns {Tile | null}
     */
    public getTile(dir: Direction): null | Tile {

        if (this.root === null)
            return null;

        if (this.fullscreen)
            return this.root.find((t) => t.state === TileState.MAXIMIZED);

        let getTileBis = (t : Tile) : Tile | null => {
            switch (dir) {
                case Direction.East:
                    if (t.child2 !== null && t.child1 !== null)
                        return t.child1.position.x > t.child2.position.x ? getTileBis(t.child1) : getTileBis(t.child2);
                    else if (t.child1 !== null)
                        return getTileBis(t.child1);
                    else if (t.child2 !== null)
                        return getTileBis(t.child2);
                    else
                        return t;
                case Direction.West:
                    if (t.child2 !== null && t.child1 !== null)
                        return t.child1.position.x < t.child2.position.x ? getTileBis(t.child1) : getTileBis(t.child2);
                    else if (t.child1 !== null)
                        return getTileBis(t.child1);
                    else if (t.child2 !== null)
                        return getTileBis(t.child2);
                    else
                        return t;
                case Direction.North:
                    if (t.child2 !== null && t.child1 !== null)
                        return t.child1.position.y < t.child2.position.y ? getTileBis(t.child1) : getTileBis(t.child2);
                    else if (t.child1 !== null)
                        return getTileBis(t.child1);
                    else if (t.child2 !== null)
                        return getTileBis(t.child2);
                    else
                        return t;
                case Direction.South:
                    if (t.child2 !== null && t.child1 !== null)
                        return t.child1.position.y > t.child2.position.y ? getTileBis(t.child1) : getTileBis(t.child2);
                    else if (t.child1 !== null)
                        return getTileBis(t.child1);
                    else if (t.child2 !== null)
                        return getTileBis(t.child2);
                    else
                        return t;

                default:
                    return t;
            }
        };

        return getTileBis(this.root);
    }



}