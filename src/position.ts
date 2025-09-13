import { Orientation } from "./tile.js"

export class Position {
    proportion: number;
    x: number;
    y: number;
    width: number;
    height: number;
    index : number;

    constructor(proportion: number = 1.0,
        x = 0, y = 0,
        width = 0, height = 0, index = 0) {
        this.proportion = proportion;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.index = index;
    }

    split(orientation: Orientation | null = null) {
        let vertical: boolean;

        let newPosition1 = new Position();
        newPosition1.proportion = this.proportion / 2;
        newPosition1.x = this.x;
        newPosition1.y = this.y;
        newPosition1.index = 0;

        switch (orientation) {
            case null:
            case Orientation.None:
                if (this.width > this.height) {
                    vertical = true;
                    newPosition1.width = this.width / 2;
                    newPosition1.height = this.height;
                } else {
                    vertical = false;
                    newPosition1.width = this.width;
                    newPosition1.height = this.height / 2;
                }
                break;
            case Orientation.Horizontal:
                vertical = true;
                newPosition1.width = this.width / 2;
                newPosition1.height = this.height;
                break;

            case Orientation.Vertical:
                vertical = false;
                newPosition1.width = this.width;
                newPosition1.height = this.height / 2;
                break;
        }

        let newPosition2 = new Position(
            this.proportion / 2,
            vertical ? this.x + this.width / 2 : this.x,
            vertical ? this.y : this.y + this.height / 2,
            vertical ? this.width / 2 : this.width,
            vertical ? this.height : this.height / 2,
            1
        );

        return [newPosition1, newPosition2];
    }


    public static fromObject(obj : any) {
        return new Position(obj.proportion, obj.x, obj.y, obj.width, obj.height, obj.index);
    } 

}