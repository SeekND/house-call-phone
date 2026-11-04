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

// --- Two real marks (card S15 round 2) ---------------------------------------------------------------------------
// The doorway line-up leans on the Quest's map, whose frames are placed by hand: in S15's run the map's doorway and the
// real one were far enough apart to put the man 56 cm off. Two small things on the floor are seen by the phone's
// camera and the headset's passthrough alike: the phone taps them (`p1`, `p2`, in its world), the headset touches
// them with the controller's tip (`q1`, `q2`, in its world, at the floor's height). The maths is `lineUp()`'s, with
// these points in place of the doorway's feet.

// How far apart the two worlds may read the marks' spacing (m) before the marks are asked for again.
export const MARK_TOL = 0.03;
// Marks closer than this give a turn too shaky to use. The doorway's two sides (the default line-up now, 60 cm to a metre
// apart) are the shortest line this takes: a centimetre off at one of them is 1.2° of turn at 80 cm.
export const MARK_MIN = 0.5;

export function across(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }

// The line-up on two marks, with the check on them: {lu, ok, gap (m: how much further apart the phone read them than
// the headset did), why (words for the player, "" when ok)}.
export function lineUpMarks(p1, p2, q1, q2) {
	const lu = lineUp(p1, p2, q1, q2);
	const cm = Math.abs(lu.widthErr) * 100;
	const near = Math.min(across(p1, p2), across(q1, q2)) < MARK_MIN;
	let why = "";
	if (near) why = "The two sides are only " + (Math.min(across(p1, p2), across(q1, q2)) * 100).toFixed(0) + " cm apart: use the doorway's left side, then its right.";
	else if (Math.abs(lu.widthErr) > MARK_TOL) why = "The phone read the doorway's two sides " + cm.toFixed(0) + " cm " + (lu.widthErr > 0 ? "further apart" : "closer together") + " than the headset did (3 cm is the most).";
	return { lu, ok: why === "", gap: lu.widthErr, why };
}

// The line-up's error at a third mark: how far across the floor `p3` (the phone's tap) lands from `q3` (the headset's
// touch) once carried into the Quest's world, in metres.
export function thirdError(p3, lu, q3) { return across(toQuest(p3, lu), q3); }

// The two marks and the third: the line-up that fits all three. A player who taps the marks in the other order than
// the headset touched them is a half turn off about the marks' middle, which a third mark off their line shows at once
// (twice its distance from the middle). If the other order fits to `FIT` and the given one doesn't, it is the other
// order: {lu, swapped, error}.
const FIT = 0.15, MISFIT = 0.3;
export function lineUpMarksThird(p1, p2, q1, q2, p3, q3) {
	const lu = lineUp(p1, p2, q1, q2), e0 = thirdError(p3, lu, q3);
	if (e0 > MISFIT) {
		const alt = lineUp(p2, p1, q1, q2), e1 = thirdError(p3, alt, q3);
		if (e1 < FIT) return { lu: alt, swapped: true, error: e1 };
	}
	return { lu, swapped: false, error: e0 };
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
