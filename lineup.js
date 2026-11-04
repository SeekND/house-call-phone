// The line-up (card S15, docs/plans/S15-phone-in-the-flat.md): the phone's AR world starts wherever Chrome
// switched it on. Two taps on the floor at a doorway's two feet, which the Quest's map knows, give the turn and
// the move that put it onto the Quest's flat. The same maths as net/phone_link.gd `line_up()`.
// Points are [x, y, z] in metres, y up; both worlds are right-handed, as WebXR and Godot are.

// A turn by `yaw` about +y, as Godot's Basis(UP, yaw) and three.js's rotation.y do:
// (x, z) goes to (x cos + z sin, -x sin + z cos).
export function turn(p, yaw) {
	const c = Math.cos(yaw), s = Math.sin(yaw);
	return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

export function wrap(a) {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a < -Math.PI) a += 2 * Math.PI;
	return a;
}

// Taps `a` (the frame's left foot) and `b` (its right) in the phone's world; `qa`, `qb` the same feet in the
// Quest's. Returns {yaw, move, widthErr}: a phone point p is at turn(p, yaw) + move in the Quest's world.
// widthErr (m) is how far the taps' spacing is off the doorway's: a check on the taps, which the user sees.
export function lineUp(a, b, qa, qb) {
	const px = b[0] - a[0], pz = b[2] - a[2], qx = qb[0] - qa[0], qz = qb[2] - qa[2];
	// Under the turn, a direction across the floor at angle atan2(-z, x) gains yaw.
	const yaw = wrap(Math.atan2(-qz, qx) - Math.atan2(-pz, px));
	const pm = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
	const qm = [(qa[0] + qb[0]) / 2, (qa[1] + qb[1]) / 2, (qa[2] + qb[2]) / 2];
	const t = turn(pm, yaw);
	return { yaw, move: [qm[0] - t[0], qm[1] - t[1], qm[2] - t[2]], widthErr: Math.hypot(px, pz) - Math.hypot(qx, qz) };
}

export function toQuest(p, lu) {
	const t = turn(p, lu.yaw);
	return [t[0] + lu.move[0], t[1] + lu.move[1], t[2] + lu.move[2]];
}

export function toPhone(q, lu) {
	return turn([q[0] - lu.move[0], q[1] - lu.move[1], q[2] - lu.move[2]], -lu.yaw);
}

// How far `q` (the Quest's world) is on the side of `door` its normal points to: where the player was asked to
// stand. A door from net/phone_link.gd `scene_dict()`: {centre, left, right, normal, ...}.
export function side(q, door) {
	return (q[0] - door.centre[0]) * door.normal[0] + (q[2] - door.centre[2]) * door.normal[2];
}

// Two taps in either order, and where the phone was: the line-up that puts the phone on the side it stood.
// A player who tapped right then left still lines up; `swapped` says so.
export function lineUpDoor(t1, t2, door, phone) {
	let lu = lineUp(t1, t2, door.left, door.right), swapped = false;
	if (side(toQuest(phone, lu), door) < 0) {
		lu = lineUp(t2, t1, door.left, door.right);
		swapped = true;
	}
	return { ...lu, swapped };
}
