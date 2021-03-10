/**
 * A FIFO style limited size map, used to prevent memory from growing unboundedly when tracking messages.
 */
export class LimitedSizeMap<K, V> extends Map<K, V> implements Map<K, V> {
	private _maxSize: number;

	constructor(maxSize: number) {
		super();
		this._maxSize = maxSize;
	}

	set(key: K, val: V) {
		super.set(key, val);

		if (this.size > this._maxSize) {
			// Keys returns an iterable in insertion order, so this removes the oldest entry from the map.
			this.delete(this.keys().next().value);
		}

		return this;
	}
}
