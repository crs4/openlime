
/**
 * 
 * @param {number} x position
 * @param {number} y position
 * @param {number} z scale
 * @param {number} a rotation
 * @param {number} t time
 *
 */

class Transform {
	constructor(options) {
		Object.assign(this, { x:0, y:0, z:1, a:0, t:0 });

		if(!this.t) this.t = performance.now();
		
		if(typeof(options) == 'object')
			Object.assign(this, options);
	}

	copy() {
		let transform = new Transform();
		Object.assign(transform, this);
		return transform;
	}

	apply(x, y) {
		//TODO! ROTATE
		let r = this.rotate(x, y, this.a);
		return { 
			x: r.x*this.z + this.x,
			y: r.y*this.z + this.y
		}
	}

	inverse() {
		let r = this.rotate(this.x, this.y, -this.a);
		return new Transform({x:-r.x, y:-r.y, z:1/this.z, a:-this.a, t:this.t});
	}

	rotate(x, y, angle) {
		angle = Math.PI*(angle/180);
		let ex =  Math.cos(angle)*x + Math.sin(angle)*y;
		let ey = -Math.sin(angle)*x + Math.cos(angle)*y;
		return {x:ex, y:ey};
	}

	compose(transform) {
		let a = this.copy();
		let b = transform;
		a.z *= b.z;
		a.a += b.a;
		var r = this.rotate(a.x, a.y, b.a);
		a.x = r.x*b.z + b.x;
		a.y = r.y*b.z + b.y; 
		return a;
	}

	/* transform the box (for example -w/2, -h/2 , w/2, h/2 in scene coords) */
	transformBox(lbox) {
		let box = [ 1e20, 1e20, -1e20, -1e20];
		for(let i = 0; i < 4; i++) {
			let p = this.apply(lbox[0 + (i&0x1)<<1], lbox[1 + (i&0x2)]);
			box[0] = Math.min(p.x, box[0]);
			box[1] = Math.min(p.y, box[1]);
			box[2] = Math.max(p.x, box[2]);
			box[3] = Math.max(p.y, box[3]);
		}
		return box;
	}

/*  get the bounding box (in image coordinate sppace) of the vieport. 
 */
	getInverseBox(viewport) {
		let inverse = this.inverse();
		let corners = [
			{x:viewport.x,               y:viewport.y},
			{x:viewport.x + viewport.dx, y:viewport.y},
			{x:viewport.x,               y:viewport.y + viewport.dy},
			{x:viewport.x + viewport.dx, y:viewport.y + viewport.dy}
		];
		let box = [ 1e20, 1e20, -1e20, -1e20];
		for(let corner of corners) {
			let p = inverse.apply(corner.x -viewport.w/2, corner.y - viewport.h/2);
			box[0] = Math.min(p.x, box[0]);
			box[1] = Math.min(p.y, box[1]);
			box[2] = Math.max(p.x, box[2]);
			box[3] = Math.max(p.y, box[3]);
		}
		return box;
	}

	interpolate(source, target, time) {
		if(time < source.t) return source;
		if(time > target.t) return target;

		let t = (target.t - source.t);
		if(t < 0.0001) {
			Object.assign(this, target);
			return;
		}

		let tt = (time - source.t)/t;
		let st = (target.t - time)/t;

		for(let i of ['x', 'y', 'z', 'a'])
			this[i] = (st*source[i] + tt*target[i]);
		this.t = time;
	}



/**
 *  Combines the transform with the viewport to the viewport with the transform
 * @param {Object} transform a {@link Transform} class.
 */
	projectionMatrix(viewport) {
		let z = this.z;
		let zx = 2*z/viewport.w;
		let zy = 2*z/viewport.h;

		let dx = (this.x)*zx;
		let dy = -(this.y)*zy;

//		let r = this.rotate(this.x, this.y, this.a);

		let a = Math.PI *this.a/180;
		let matrix = [
			 Math.cos(a)*zx, Math.sin(a)*zy,  0,  0, 
			-Math.sin(a)*zx, Math.cos(a)*zy,  0,  0,
			 0,  0,  1,  0,
			dx, dy, 0,  1];
		return matrix;
	}

/**
 * TODO (if needed)
 */ 
	toMatrix() {
		let z = this.z;
		return [
			z,   0,   0,   0,
			0,   z,   0,   0, 
			0,   0,   1,   0,
			z*x, z*y, 0,   1,
		];
	}

}

function matrixMul(a, b) {
	let r = new Array(16);
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 4; j++) {
			r[j + i*4] = 0;
			for (let k = 0; k < N; k++) {
				r[j + i*4] += a[k + i*4]*b[k + j*4]
			}
		}
	}
	return r;
}

function matMul(a, b) {
	let r = new Array(16);
	r[ 0] = a[0]*b[0] + a[4]*b[1] + a[8]*b[2] + a[12]*b[3];
	r[ 1] = a[1]*b[0] + a[5]*b[1] + a[9]*b[2] + a[13]*b[3];
	r[ 2] = a[2]*b[0] + a[6]*b[1] + a[10]*b[2] + a[14]*b[3];
	r[ 3] = a[3]*b[0] + a[7]*b[1] + a[11]*b[2] + a[15]*b[3];

	r[ 4] = a[0]*b[4] + a[4]*b[5] + a[8]*b[6] + a[12]*b[7];
	r[ 5] = a[1]*b[4] + a[5]*b[5] + a[9]*b[6] + a[13]*b[7];
	r[ 6] = a[2]*b[4] + a[6]*b[5] + a[10]*b[6] + a[14]*b[7];
	r[ 7] = a[3]*b[4] + a[7]*b[5] + a[11]*b[6] + a[15]*b[7];

	r[ 8] = a[0]*b[8] + a[4]*b[9] + a[8]*b[10] + a[12]*b[11];
	r[ 9] = a[1]*b[8] + a[5]*b[9] + a[9]*b[10] + a[13]*b[11];
	r[10] = a[2]*b[8] + a[6]*b[9] + a[10]*b[10] + a[14]*b[11];
	r[11] = a[3]*b[8] + a[7]*b[9] + a[11]*b[10] + a[15]*b[11];

	r[12] = a[0]*b[12] + a[4]*b[13] + a[8]*b[14] + a[12]*b[15];
	r[13] = a[1]*b[12] + a[5]*b[13] + a[9]*b[14] + a[13]*b[15];
	r[14] = a[2]*b[12] + a[6]*b[13] + a[10]*b[14] + a[14]*b[15];
	r[15] = a[3]*b[12] + a[7]*b[13] + a[11]*b[14] + a[15]*b[15];
	return r;
}

export { Transform, matMul }
