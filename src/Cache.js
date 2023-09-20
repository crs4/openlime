/*
 * The singleton class **Cache** implements a cache for faster retrieval of the tiles required by layers.
 * @class Cache
 */
/** @ignore */
class _Cache {
	/**
	 * Instantiates a Cache object. Tiles to be fetched are stored in an ordered `queue` in {Layer}.
	 * @param {Object} [options] An object literal with cache parameters.
	 * @param {number} options.capacity=536870912 The total cache capacity (in bytes).
	 * @param {number} options.maxRequest=6 Max number of concurrent HTTP requests. Most common browsers allow six connections per domain.
	 */
	constructor(options) {
		Object.assign(this, {
			capacity: 512*(1<<20),  //256 MB total capacity available
			size: 0,                //amount of GPU ram used

			maxRequest: 6,          //max number of concurrent HTTP requests
			maxRequestsRate: 10,     //max number of requests per period.
			maxRequestsPeriod: 1000,  //period in milliseconds
			requestRateTimeout: null, //calls update when a new slot is available due to request rate.
			requestLog: [],           //holdls last requests timestamps.
			requested: 0,
			maxPrefetch: 8*(1<<20), //max amount of prefetched tiles.
			prefetched: 0           //amount of currently prefetched GPU ram.
		});

		Object.assign(this, options);
		this.layers = [];   //map on layer.
	}

	/**
	 * Determines which tiles of a given `layer` are candidates to be downloaded.
	 * Cleans up the cache and schedules the web data fetch. 
	 * @param {Layer} layer A layer.
	 */
	setCandidates(layer) {
		if(!this.layers.includes(layer))
			this.layers.push(layer);
		setTimeout(() => { this.update(); }, 0); //ensure all the queues are set before updating.
	}

	/** @ignore */
	rateLimited() {
		console.log('rate!');
		if(this.requested > this.maxRequest)
			return true;
		
		let now = performance.now();
		//clean up old requests
		while(this.requestLog.length > 0) {
			if(this.requestLog[0] + this.maxRequestsPeriod < now )
				this.requestLog.shift();
			else
				break;
		}

		if(this.requestLog.length > this.maxRequestsRate) {
			//update again when the first request expires.
			if(!this.requestRateTimeout) {
				console.log('setTimeout', this.requestRateTimeout, this.maxRequestsPeriod - (now - this.requestLog[0]) + 50);
				this.requestRateTimeout = setTimeout(() => {
					console.log('update');
					this.requestRateTimeout = null;
					this.update();
				}, this.maxRequestsPeriod - (now - this.requestLog[0]) + 50);
				console.log('settedTimeout', this.requestRateTimeout);
			}
			return true;
		}
		return false;
	}
	/** @ignore */
	update() {
		if(this.rateLimited())
			return;
		

		let best = this.findBestCandidate();
		if(!best) return;
		while(this.size > this.capacity) { //we need to make room.
			let worst = this.findWorstTile();
			if(!worst) {
				console.log("BIG problem in the cache");
				break;
			}
			if(worst.tile.time < best.tile.time)
				this.dropTile(worst.layer, worst.tile)
			else
				return; 
		}
		console.assert(best != best.layer.queue[0]);
		best.layer.queue.shift();
		this.requestLog.push(performance.now());
		this.loadTile(best.layer, best.tile);
	}

	/* Finds the best tile to be downloaded */
	/** @ignore */
	findBestCandidate() {
		let best = null;
		for(let layer of this.layers) {
			while(layer.queue.length > 0 && layer.tiles.has(layer.queue[0].index)) {
				layer.queue.shift();
			}
			if(!layer.queue.length)
				continue;
			let tile = layer.queue[0];
			if(!best ||
				tile.time > best.tile.time  + 1.0 ||  //old requests ignored
				tile.priority > best.tile.priority)
				best = { layer, tile }
		}
		return best;
	}

	/* Finds the worst tile to be dropped */
	/** @ignore */
	findWorstTile() {
		let worst = null;
		for(let layer of this.layers) {
			for(let tile of layer.tiles.values()) {
				//TODO might be some are present when switching shaders.
				if(tile.missing != 0) continue;
				if(!worst || 
				   tile.time < worst.tile.time || 
				   (tile.time == worst.tile.time && tile.priority < worst.tile.priority)) {
					worst = {layer, tile};
				}
			}
		}
		return worst;
	}

	/** @ignore */
	loadTile(layer, tile) {
		this.requested++;
		(async () =>  { layer.loadTile(tile, (size) => { this.size += size; this.requested--; this.update(); } ); })();
	}

	/** @ignore */
	dropTile(layer, tile) {
		this.size -= tile.size;
		layer.dropTile(tile);
	}


	/**
	 * Flushes all tiles for a `layer`.
	 * @param {Layer} layer A layer.
 	 */
	flushLayer(layer) {
		if(!this.layers.includes(layer))
			return;
		for(let tile of layer.tiles.values())
			this.dropTile(layer, tile);
	}
}

/**
 * Instantiates a Cache object. Tiles to be fetched are stored in an ordered `queue` in {Layer}.
 * @classdesc The singleton class **Cache** implements a cache for faster retrieval of the tiles required by layers.
 * @class Cache
 * @param {Object} [options] An object literal to define cache parameters.
 * @param {number} options.capacity=536870912 The total cache capacity (in bytes).
 * @param {number} options.maxRequest=6 Max number of concurrent HTTP requests. Most common browsers allow six connections per domain.
 */
let Cache = new _Cache;

/**
 * Flushes all tiles for a `layer`.
 * @function flushLayer
 * @memberof Cache
 * @instance
 * @param {Layer} layer A layer.
 */

/**
 * Determines which tiles of a given `layer` are candidates to be downloaded.
 * Cleans up the cache and schedules the web data fetch.
 * @function setCandidates
 * @memberof Cache
 * @instance
 * @param {Layer} layer A layer.
 */


export { Cache }
